create table if not exists profiles (
  user_id text primary key references "user" ("id") on delete cascade,
  full_name text not null,
  email text not null,
  account_number text not null unique,
  role text not null default 'client' check (role in ('client', 'admin')),
  status text not null default 'active' check (status in ('active', 'restricted', 'frozen')),
  entity_type text not null default 'individual' check (entity_type in ('individual', 'institution')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on profiles (lower(email));
create index if not exists profiles_account_idx on profiles (account_number);

create table if not exists wallets (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  asset text not null check (asset in ('USDT', 'BTC')),
  network text not null,
  available numeric not null default 0,
  held numeric not null default 0,
  allocated numeric not null default 0,
  unique (user_id, asset)
);

create table if not exists transactions (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  kind text not null,
  asset text not null,
  amount numeric not null,
  direction text not null check (direction in ('credit', 'debit')),
  status text not null,
  reference text,
  counterparty text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists transactions_user_idx on transactions (user_id, created_at desc);

create table if not exists deposit_requests (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  transaction_id text not null references transactions (id),
  asset text not null,
  amount numeric not null,
  network text not null,
  tx_reference text,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists deposit_requests_status_idx on deposit_requests (status, created_at);

create table if not exists transfer_requests (
  id text primary key,
  from_user_id text not null references profiles (user_id),
  to_user_id text not null references profiles (user_id),
  out_transaction_id text not null,
  in_transaction_id text not null,
  asset text not null,
  amount numeric not null,
  memo text,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists transfer_requests_status_idx on transfer_requests (status, created_at);

create table if not exists notifications (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists allocations (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  strategy text not null,
  asset text not null,
  principal numeric not null,
  realized numeric not null default 0,
  exposure numeric not null,
  entry_mark numeric not null,
  last_mark numeric not null,
  pnl_posted numeric not null default 0,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists allocations_user_idx on allocations (user_id, opened_at desc);
