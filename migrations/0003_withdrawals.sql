create table if not exists withdrawal_requests (
  id text primary key,
  user_id text not null references profiles (user_id) on delete cascade,
  transaction_id text not null references transactions (id),
  asset text not null,
  amount numeric not null,
  network text not null,
  destination text not null,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists withdrawal_requests_status_idx on withdrawal_requests (status, created_at);
