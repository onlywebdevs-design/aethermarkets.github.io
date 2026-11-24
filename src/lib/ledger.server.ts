import { getSql, type Sql } from "@/lib/db";
import { DESK_EMAIL } from "@/lib/desk.constants.server";
import { parseAmount, toMinor, fromMinor, type Asset } from "@/lib/money";
import { mandateById, MIN_DEPOSIT_USD, type MandateId } from "@/lib/rails";
import type {
  AccountStatus,
  AllocationView,
  ClientFile,
  ClientRow,
  DeskOverview,
  EntityType,
  LedgerEntry,
  Notice,
  PendingDeposit,
  PendingTransfer,
  PendingWithdrawal,
  PortalHome,
  ProfileView,
  ReceiptView,
  Role,
  WalletView,
} from "@/lib/types";
import { readMark } from "@/lib/market.server";

type ProfileRow = {
  user_id: string;
  full_name: string;
  email: string;
  account_number: string;
  role: string;
  status: string;
  entity_type: string;
  created_at: unknown;
};

type WalletRow = {
  asset: string;
  network: string;
  available: unknown;
  held: unknown;
  allocated: unknown;
};

type TxRow = {
  id: string;
  user_id: string;
  kind: string;
  asset: string;
  amount: unknown;
  direction: string;
  status: string;
  reference: string | null;
  counterparty: string | null;
  metadata: unknown;
  created_at: unknown;
  settled_at: unknown;
};

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return value;
  }
  return new Date().toISOString();
}

function isoOrNull(value: unknown): string | null {
  if (value == null) return null;
  return iso(value);
}

function num(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "0";
}

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function metaOf(value: unknown): Record<string, string> {
  let obj: unknown = value;
  if (typeof value === "string") {
    try {
      obj = JSON.parse(value);
    } catch {
      obj = {};
    }
  }
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val == null) continue;
    out[key] = String(val);
  }
  return out;
}

function qid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function makeRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = "AE-";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

function clean(value: string, max: number): string {
  const t = value.replace(/[<>]/g, "").trim();
  if (t.length > max) throw new Error("That field is too long.");
  return t;
}

function mapProfile(row: ProfileRow): ProfileView {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    accountNumber: row.account_number,
    role: row.role === "admin" ? "admin" : "client",
    status: (row.status as AccountStatus) || "active",
    entityType: row.entity_type === "institution" ? "institution" : "individual",
    createdAt: iso(row.created_at),
  };
}

function mapWallet(row: WalletRow): WalletView {
  const asset: Asset = row.asset === "BTC" ? "BTC" : "USDT";
  return {
    asset,
    network: row.network,
    available: num(row.available),
    held: num(row.held),
    allocated: num(row.allocated),
  };
}

function mapTx(row: TxRow, includeInternal: boolean): LedgerEntry {
  const m = metaOf(row.metadata);
  const asset: Asset = row.asset === "BTC" ? "BTC" : "USDT";
  const entry: LedgerEntry = {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    asset,
    amount: num(row.amount),
    direction: row.direction === "debit" ? "debit" : "credit",
    status: row.status,
    reference: row.reference ?? "",
    counterparty: row.counterparty ?? "",
    network: m.network ?? "",
    institution: m.originating_institution ?? "",
    valueDate: m.value_date ?? "",
    valueTime: m.value_time ?? "",
    memo: m.memo ?? "",
    decisionNote: m.decision_note ?? "",
    destination: m.destination ?? "",
    strategy: m.strategy ?? "",
    createdAt: iso(row.created_at),
    settledAt: isoOrNull(row.settled_at),
  };
  if (includeInternal) entry.internalNote = m.internal_note ?? "";
  return entry;
}

async function nextAccount(sql: Sql): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const n = `AM-${Math.floor(100000 + Math.random() * 900000)}`;
    const hit = await sql`select 1 from profiles where account_number = ${n}`;
    if (!hit.length) return n;
  }
  return `AM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function ensureWallets(sql: Sql, userId: string): Promise<void> {
  await sql`
    insert into wallets (id, user_id, asset, network)
    values (${qid("wal")}, ${userId}, 'USDT', 'Arbitrum')
    on conflict (user_id, asset) do nothing
  `;
  await sql`
    insert into wallets (id, user_id, asset, network)
    values (${qid("wal")}, ${userId}, 'BTC', 'Bitcoin')
    on conflict (user_id, asset) do nothing
  `;
}

export async function ensureProfile(userId: string): Promise<ProfileView> {
  const sql = await getSql();
  const existing = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
  if (!existing[0]) {
    const users = await sql<{ name: string; email: string }>`
      select name, email from "user" where id = ${userId}
    `;
    const user = users[0];
    if (!user) throw new Error("Account record missing.");
    const email = user.email;
    const role: Role = email.toLowerCase() === DESK_EMAIL ? "admin" : "client";
    const number = await nextAccount(sql);
    try {
      await sql`
        insert into profiles (user_id, full_name, email, account_number, role, status, entity_type)
        values (
          ${userId},
          ${user.name || "Client"},
          ${email},
          ${number},
          ${role},
          'active',
          'individual'
        )
      `;
    } catch {
      const again = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
      if (!again[0]) throw new Error("The account profile could not be opened.");
      await ensureWallets(sql, userId);
      return mapProfile(again[0]);
    }
  }
  await ensureWallets(sql, userId);
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
  if (!rows[0]) throw new Error("The account profile could not be opened.");
  if (rows[0].email.toLowerCase() === DESK_EMAIL && rows[0].role !== "admin") {
    await sql`update profiles set role = 'admin' where user_id = ${userId}`;
    rows[0].role = "admin";
  }
  return mapProfile(rows[0]);
}

async function requireOfficer(userId: string): Promise<ProfileView> {
  const profile = await ensureProfile(userId);
  if (profile.role !== "admin") throw new Error("Restricted to authorized officers.");
  return profile;
}

function assertMove(profile: ProfileView, kind: "deposit" | "transfer" | "allocate" | "withdraw") {
  if (profile.status === "frozen") {
    throw new Error("This account is frozen. Contact your officer before initiating a movement.");
  }
  if (profile.status === "restricted" && kind !== "deposit") {
    throw new Error("Transfers, withdrawals, and new mandates are paused on this account.");
  }
}

function destinationFor(asset: Asset, raw: string): string {
  const address = clean(raw, 120);
  if (asset === "BTC") {
    const bech32 = /^bc1[ac-hj-np-z02-9]{11,87}$/i.test(address);
    const legacy = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
    if (!bech32 && !legacy) throw new Error("Enter a Bitcoin address.");
    return address;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Enter an Arbitrum address for USD₮.");
  }
  return address;
}

async function walletsOf(sql: Sql, userId: string): Promise<WalletView[]> {
  const rows = await sql<WalletRow>`
    select asset, network, available, held, allocated
    from wallets where user_id = ${userId} order by asset desc
  `;
  return rows.map(mapWallet);
}

async function entriesOf(
  sql: Sql,
  userId: string,
  includeInternal: boolean,
  limit = 200,
): Promise<LedgerEntry[]> {
  const rows = await sql<TxRow>`
    select * from transactions
    where user_id = ${userId}
    order by created_at desc
    limit ${limit}
  `;
  return rows.map((row) => mapTx(row, includeInternal));
}

export async function portalHome(userId: string): Promise<PortalHome> {
  const sql = await getSql();
  const profile = await ensureProfile(userId);
  const [wallets, recent, notices, unreadRows, mark, pnlRows, clearedRows] = await Promise.all([
    walletsOf(sql, userId),
    entriesOf(sql, userId, false, 8),
    sql<{ id: string; title: string; body: string; read_at: unknown; created_at: unknown }>`
      select id, title, body, read_at, created_at from notifications
      where user_id = ${userId} order by created_at desc limit 6
    `,
    sql<{ n: unknown }>`
      select count(*) as n from notifications where user_id = ${userId} and read_at is null
    `,
    readMark(),
    sql<{ pnl: unknown }>`
      select coalesce(sum(realized - pnl_posted), 0) as pnl
      from allocations where user_id = ${userId} and status = 'open'
    `,
    sql<{ n: unknown }>`
      select count(*) as n from transactions
      where user_id = ${userId}
        and status = 'settled'
        and direction = 'credit'
        and kind in ('deposit', 'ledger_credit', 'transfer_in')
    `,
  ]);
  const tradingUnlocked = profile.role === "admin" || asInt(clearedRows[0]?.n) > 0;
  return {
    profile,
    wallets,
    recent,
    notices: notices.map(mapNotice),
    unread: asInt(unreadRows[0]?.n),
    mark,
    tradingUnlocked,
    openPnl: num(pnlRows[0]?.pnl),
  };
}

function mapNotice(row: {
  id: string;
  title: string;
  body: string;
  read_at: unknown;
  created_at: unknown;
}): Notice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    readAt: isoOrNull(row.read_at),
    createdAt: iso(row.created_at),
  };
}

export async function listEntries(userId: string): Promise<LedgerEntry[]> {
  await ensureProfile(userId);
  const sql = await getSql();
  return entriesOf(sql, userId, false, 300);
}

export async function listNotices(userId: string): Promise<Notice[]> {
  await ensureProfile(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    title: string;
    body: string;
    read_at: unknown;
    created_at: unknown;
  }>`
    select id, title, body, read_at, created_at from notifications
    where user_id = ${userId} order by created_at desc limit 100
  `;
  return rows.map(mapNotice);
}

export async function markNotice(userId: string, id: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update notifications set read_at = now()
    where id = ${id} and user_id = ${userId} and read_at is null
  `;
}

export async function markAllNotices(userId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    update notifications set read_at = now()
    where user_id = ${userId} and read_at is null
  `;
}

export async function setEntity(
  userId: string,
  fullName: string,
  entityType: EntityType,
): Promise<ProfileView> {
  const profile = await ensureProfile(userId);
  const name = clean(fullName, 80);
  if (name.length < 2) throw new Error("Enter the name on the account.");
  const sql = await getSql();
  await sql`
    update profiles set full_name = ${name}, entity_type = ${entityType}
    where user_id = ${profile.userId}
  `;
  await sql`update "user" set name = ${name}, "updatedAt" = now() where id = ${profile.userId}`;
  return { ...profile, fullName: name, entityType };
}

export async function submitDeposit(
  userId: string,
  input: { asset: Asset; amount: string; reference: string },
): Promise<{ message: string; transactionId: string }> {
  const profile = await ensureProfile(userId);
  assertMove(profile, "deposit");
  const amount = parseAmount(input.amount, input.asset);
  const mark = await readMark();
  const usd = input.asset === "USDT" ? Number(amount) : Number(amount) * mark.btcUsd;
  if (!(usd >= MIN_DEPOSIT_USD)) {
    throw new Error(`Minimum inbound amount is ${MIN_DEPOSIT_USD} USD.`);
  }
  const reference = input.reference ? clean(input.reference, 140) : makeRef();
  const when = new Date();
  const txId = qid("tx");
  const depId = qid("dep");
  const noteId = qid("ntf");
  const network = input.asset === "BTC" ? "Bitcoin" : "Arbitrum";
  const metadata = {
    originating_institution: network,
    network,
    value_date: when.toISOString().slice(0, 10),
    value_time: when.toISOString().slice(11, 16),
    tx_reference: reference,
  };
  const sql = await getSql();
  const rows = await sql<{ n: unknown }>`
    with tx as (
      insert into transactions (
        id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata
      ) values (
        ${txId}, ${userId}, 'deposit', ${input.asset}, ${amount}::numeric, 'credit', 'pending',
        ${reference}, 'External wallet', ${JSON.stringify(metadata)}::jsonb
      )
      returning id
    ),
    dep as (
      insert into deposit_requests (
        id, user_id, transaction_id, asset, amount, network, tx_reference, status
      )
      select ${depId}, ${userId}, tx.id, ${input.asset}, ${amount}::numeric, ${network}, ${reference}, 'pending'
      from tx
      returning id
    ),
    note as (
      insert into notifications (id, user_id, title, body)
      select ${noteId}, ${userId}, 'Deposit received – processing',
        'Operations will review the inbound item before it is posted to your available balance.'
      from dep
      returning id
    )
    select (select count(*) from dep) as n
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("The deposit could not be recorded.");
  return { message: "Deposit received – processing", transactionId: txId };
}

export async function submitTransfer(
  userId: string,
  input: { asset: Asset; amount: string; recipient: string; memo: string },
): Promise<{ message: string }> {
  const profile = await ensureProfile(userId);
  assertMove(profile, "transfer");
  const amount = parseAmount(input.amount, input.asset);
  const recipientKey = clean(input.recipient, 160);
  if (!recipientKey) throw new Error("Enter the receiving account number or email.");
  const memo = input.memo ? clean(input.memo, 280) : "";
  const sql = await getSql();
  const targets = await sql<ProfileRow>`
    select * from profiles
    where account_number = ${recipientKey} or lower(email) = lower(${recipientKey})
    limit 1
  `;
  const target = targets[0] ? mapProfile(targets[0]) : null;
  if (!target) throw new Error("No account matches that number or email.");
  if (target.userId === userId) {
    throw new Error("Use a different account. Movements to your own number are not posted this way.");
  }
  if (target.status === "frozen") throw new Error("The receiving account cannot accept funds.");
  const when = new Date();
  const outId = qid("tx");
  const inId = qid("tx");
  const reqId = qid("xfer");
  const metadata = {
    memo,
    value_date: when.toISOString().slice(0, 10),
    value_time: when.toISOString().slice(11, 16),
    network: input.asset === "BTC" ? "Bitcoin" : "Arbitrum",
  };
  const rows = await sql<{ n: unknown }>`
    with held as (
      update wallets
      set available = available - ${amount}::numeric,
          held = held + ${amount}::numeric
      where user_id = ${userId} and asset = ${input.asset} and available >= ${amount}::numeric
      returning user_id
    ),
    txo as (
      insert into transactions (
        id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata
      )
      select ${outId}, ${userId}, 'transfer_out', ${input.asset}, ${amount}::numeric, 'debit', 'pending',
        ${makeRef()}, ${target.fullName}, ${JSON.stringify(metadata)}::jsonb
      from held
      returning id
    ),
    txi as (
      insert into transactions (
        id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata
      )
      select ${inId}, ${target.userId}, 'transfer_in', ${input.asset}, ${amount}::numeric, 'credit', 'pending',
        ${makeRef()}, ${profile.fullName}, ${JSON.stringify(metadata)}::jsonb
      from held
      returning id
    ),
    req as (
      insert into transfer_requests (
        id, from_user_id, to_user_id, out_transaction_id, in_transaction_id, asset, amount, memo, status
      )
      select ${reqId}, ${userId}, ${target.userId}, ${outId}, ${inId}, ${input.asset}, ${amount}::numeric, ${memo}, 'pending'
      from held
      returning id
    )
    select (select count(*) from req) as n
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("Available balance is not sufficient for that transfer.");
  await sql`
    insert into notifications (id, user_id, title, body)
    values (
      ${qid("ntf")}, ${userId}, 'Transfer submitted',
      'The amount is reserved until an officer settles or returns it.'
    )
  `;
  return { message: "Transfer submitted for settlement." };
}

export async function submitWithdrawal(
  userId: string,
  input: { asset: Asset; amount: string; destination: string },
): Promise<{ message: string; transactionId: string }> {
  const profile = await ensureProfile(userId);
  assertMove(profile, "withdraw");
  const amount = parseAmount(input.amount, input.asset);
  const destination = destinationFor(input.asset, input.destination);
  const mark = await readMark();
  const usd = input.asset === "USDT" ? Number(amount) : Number(amount) * mark.btcUsd;
  if (!(usd >= MIN_DEPOSIT_USD)) {
    throw new Error(`Minimum outbound amount is ${MIN_DEPOSIT_USD} USD.`);
  }
  const network = input.asset === "BTC" ? "Bitcoin" : "Arbitrum";
  const reference = makeRef();
  const when = new Date();
  const txId = qid("tx");
  const reqId = qid("wdr");
  const noteId = qid("ntf");
  const metadata = {
    originating_institution: "Client instruction",
    network,
    destination,
    value_date: when.toISOString().slice(0, 10),
    value_time: when.toISOString().slice(11, 16),
    memo: "Reserved until operations releases the outbound send.",
  };
  const sql = await getSql();
  const rows = await sql<{ n: unknown }>`
    with held as (
      update wallets
      set available = available - ${amount}::numeric,
          held = held + ${amount}::numeric
      where user_id = ${userId} and asset = ${input.asset} and available >= ${amount}::numeric
      returning user_id
    ),
    tx as (
      insert into transactions (
        id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata
      )
      select ${txId}, ${userId}, 'withdrawal', ${input.asset}, ${amount}::numeric, 'debit', 'pending',
        ${reference}, ${destination}, ${JSON.stringify(metadata)}::jsonb
      from held
      returning id
    ),
    req as (
      insert into withdrawal_requests (
        id, user_id, transaction_id, asset, amount, network, destination, status
      )
      select ${reqId}, ${userId}, tx.id, ${input.asset}, ${amount}::numeric, ${network}, ${destination}, 'pending'
      from tx
      returning id
    ),
    note as (
      insert into notifications (id, user_id, title, body)
      select ${noteId}, ${userId}, 'Withdrawal reserved',
        'The amount is held until an officer releases the send or returns it to your available balance.'
      from req
      returning id
    )
    select (select count(*) from req) as n
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("Available balance is not sufficient for that withdrawal.");
  return { message: "Withdrawal reserved for release.", transactionId: txId };
}

export async function readReceipt(callerId: string, id: string): Promise<ReceiptView> {
  const caller = await ensureProfile(callerId);
  const sql = await getSql();
  const rows = await sql<TxRow>`select * from transactions where id = ${id}`;
  const row = rows[0];
  if (!row) throw new Error("Receipt not found.");
  if (caller.role !== "admin" && row.user_id !== callerId) throw new Error("Receipt not found.");
  const ownerRows = await sql<ProfileRow>`select * from profiles where user_id = ${row.user_id}`;
  if (!ownerRows[0]) throw new Error("Receipt not found.");
  return {
    profile: mapProfile(ownerRows[0]),
    entry: mapTx(row, caller.role === "admin"),
  };
}

export async function listAllocations(userId: string): Promise<AllocationView[]> {
  await ensureProfile(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    strategy: string;
    asset: string;
    principal: unknown;
    realized: unknown;
    exposure: unknown;
    entry_mark: unknown;
    last_mark: unknown;
    status: string;
    opened_at: unknown;
    closed_at: unknown;
  }>`
    select * from allocations where user_id = ${userId} order by opened_at desc limit 40
  `;
  return rows.map((row) => {
    const mandate = mandateById(row.strategy);
    const asset: Asset = row.asset === "BTC" ? "BTC" : "USDT";
    return {
      id: row.id,
      strategy: row.strategy,
      strategyName: mandate?.name ?? row.strategy,
      asset,
      principal: num(row.principal),
      realized: num(row.realized),
      exposure: num(row.exposure),
      entryMark: num(row.entry_mark),
      lastMark: num(row.last_mark),
      status: row.status,
      openedAt: iso(row.opened_at),
      closedAt: isoOrNull(row.closed_at),
    };
  });
}

export async function openAllocation(
  userId: string,
  strategy: MandateId,
  amountInput: string,
): Promise<{ id: string }> {
  const profile = await ensureProfile(userId);
  assertMove(profile, "allocate");
  const mandate = mandateById(strategy);
  if (!mandate) throw new Error("Unknown mandate.");
  const amount = parseAmount(amountInput, "USDT");
  if (toMinor(amount, "USDT") < toMinor(mandate.min, "USDT")) {
    throw new Error(`Minimum allocation for this mandate is ${mandate.min} USD₮.`);
  }
  const mark = await readMark();
  const sql = await getSql();
  const allocId = qid("alc");
  const txId = qid("tx");
  const ref = makeRef();
  const metadata = {
    strategy: mandate.name,
    value_date: new Date().toISOString().slice(0, 10),
    value_time: new Date().toISOString().slice(11, 16),
  };
  const rows = await sql<{ n: unknown }>`
    with moved as (
      update wallets
      set available = available - ${amount}::numeric,
          allocated = allocated + ${amount}::numeric
      where user_id = ${userId} and asset = 'USDT' and available >= ${amount}::numeric
      returning user_id
    ),
    alc as (
      insert into allocations (
        id, user_id, strategy, asset, principal, realized, exposure, entry_mark, last_mark, status
      )
      select ${allocId}, ${userId}, ${mandate.id}, 'USDT', ${amount}::numeric, 0, ${mandate.exposure},
        ${mark.btcUsd}, ${mark.btcUsd}, 'open'
      from moved
      returning id
    ),
    tx as (
      insert into transactions (
        id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
      )
      select ${txId}, ${userId}, 'allocation', 'USDT', ${amount}::numeric, 'debit', 'settled',
        ${ref}, ${mandate.name}, ${JSON.stringify(metadata)}::jsonb, now()
      from alc
      returning id
    )
    select (select count(*) from alc) as n
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("Available USD₮ is not sufficient for that allocation.");
  return { id: allocId };
}

export async function markAllocation(
  userId: string,
  id: string,
): Promise<{ realized: string; note: string }> {
  const profile = await ensureProfile(userId);
  if (profile.status === "frozen") {
    throw new Error("This account is frozen. Contact your officer before initiating a movement.");
  }
  const mark = await readMark();
  const sql = await getSql();
  const rows = await sql<{ realized: unknown; n: unknown }>`
    with cur as (
      select * from allocations where id = ${id} and user_id = ${userId} and status = 'open'
    ),
    upd as (
      update allocations a
      set realized = round(least(
            greatest(
              a.realized + a.principal * a.exposure * ((${mark.btcUsd}::numeric - a.last_mark) / nullif(a.last_mark, 0)),
              -a.principal
            ),
            a.principal * 0.5
          )::numeric, 6),
          last_mark = ${mark.btcUsd}::numeric
      from cur
      where a.id = cur.id and a.last_mark is distinct from ${mark.btcUsd}::numeric
      returning a.realized
    )
    select
      (select count(*) from upd) as n,
      coalesce((select realized from upd), (select realized from cur)) as realized
  `;
  const realized = num(rows[0]?.realized);
  if (!rows.length) throw new Error("That mandate is not open.");
  if (asInt(rows[0]?.n) < 1) {
    return { realized, note: "No mark change since the last posting." };
  }
  return { realized, note: "Mark posted against the open mandate." };
}

export async function closeAllocation(userId: string, id: string): Promise<void> {
  const profile = await ensureProfile(userId);
  if (profile.status === "frozen") {
    throw new Error("This account is frozen. Contact your officer before initiating a movement.");
  }
  const sql = await getSql();
  const txId = qid("tx");
  const ref = makeRef();
  const rows = await sql<{ n: unknown; name: string | null }>`
    with closed as (
      update allocations
      set status = 'closed', closed_at = now()
      where id = ${id} and user_id = ${userId} and status = 'open'
      returning *
    ),
    wallet as (
      update wallets w
      set allocated = w.allocated - c.principal,
          available = w.available + c.principal + c.realized - c.pnl_posted
      from closed c
      where w.user_id = c.user_id and w.asset = c.asset
      returning w.user_id
    ),
    tx as (
      insert into transactions (
        id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
      )
      select ${txId}, c.user_id, 'realization', c.asset,
        abs(c.principal + c.realized), 'credit', 'settled', ${ref}, c.strategy,
        jsonb_build_object(
          'strategy', c.strategy,
          'memo', 'Mandate closed. Principal and posted result returned to available balance.',
          'value_date', to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
          'value_time', to_char(now() at time zone 'utc', 'HH24:MI')
        ),
        now()
      from closed c
      returning id
    )
    select (select count(*) from closed) as n, (select strategy from closed) as name
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("That mandate is not open.");
}

export async function executeTrade(
  userId: string,
  input: { side: "buy" | "sell"; notional: string },
): Promise<{ message: string; btc: string; price: number }> {
  const profile = await ensureProfile(userId);
  assertMove(profile, "transfer");
  const notional = parseAmount(input.notional, "USDT");
  if (toMinor(notional, "USDT") < toMinor("10", "USDT")) {
    throw new Error("Minimum order is 10 USD₮.");
  }
  const mark = await readMark();
  const btc = parseAmount((Number(notional) / mark.btcUsd).toFixed(8), "BTC");
  const sql = await getSql();
  const ref = makeRef();
  const when = new Date();
  const meta = {
    originating_institution: "Tradrz desk",
    network: "Internal",
    memo: input.side === "buy" ? "Bought bitcoin at the desk mark." : "Sold bitcoin at the desk mark.",
    value_date: when.toISOString().slice(0, 10),
    value_time: when.toISOString().slice(11, 16),
    price: String(mark.btcUsd),
    side: input.side,
  };
  const usdtId = qid("tx");
  const btcId = qid("tx");
  if (input.side === "buy") {
    const rows = await sql<{ n: unknown }>`
      with usdt as (
        update wallets
        set available = available - ${notional}::numeric
        where user_id = ${userId} and asset = 'USDT' and available >= ${notional}::numeric
        returning user_id
      ),
      btc as (
        update wallets w
        set available = w.available + ${btc}::numeric
        from usdt
        where w.user_id = ${userId} and w.asset = 'BTC'
        returning w.user_id
      ),
      txu as (
        insert into transactions (
          id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
        )
        select ${usdtId}, ${userId}, 'spot', 'USDT', ${notional}::numeric, 'debit', 'settled',
          ${ref}, 'BTC buy', ${JSON.stringify(meta)}::jsonb, now()
        from usdt
        returning id
      ),
      txb as (
        insert into transactions (
          id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
        )
        select ${btcId}, ${userId}, 'spot', 'BTC', ${btc}::numeric, 'credit', 'settled',
          ${ref}, 'BTC buy', ${JSON.stringify(meta)}::jsonb, now()
        from usdt
        returning id
      )
      select (select count(*) from txu) as n
    `;
    if (asInt(rows[0]?.n) < 1) throw new Error("Available USD₮ is not enough for that buy.");
  } else {
    const rows = await sql<{ n: unknown }>`
      with btc as (
        update wallets
        set available = available - ${btc}::numeric
        where user_id = ${userId} and asset = 'BTC' and available >= ${btc}::numeric
        returning user_id
      ),
      usdt as (
        update wallets w
        set available = w.available + ${notional}::numeric
        from btc
        where w.user_id = ${userId} and w.asset = 'USDT'
        returning w.user_id
      ),
      txb as (
        insert into transactions (
          id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
        )
        select ${btcId}, ${userId}, 'spot', 'BTC', ${btc}::numeric, 'debit', 'settled',
          ${ref}, 'BTC sell', ${JSON.stringify(meta)}::jsonb, now()
        from btc
        returning id
      ),
      txu as (
        insert into transactions (
          id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
        )
        select ${usdtId}, ${userId}, 'spot', 'USDT', ${notional}::numeric, 'credit', 'settled',
          ${ref}, 'BTC sell', ${JSON.stringify(meta)}::jsonb, now()
        from btc
        returning id
      )
      select (select count(*) from txb) as n
    `;
    if (asInt(rows[0]?.n) < 1) throw new Error("Available bitcoin is not enough for that sell.");
  }
  return {
    message: input.side === "buy" ? "Buy filled at the desk mark." : "Sell filled at the desk mark.",
    btc,
    price: mark.btcUsd,
  };
}

async function postAiFill(userId: string, id: string): Promise<{ side: "buy" | "sell"; delta: string; price: number }> {
  const mark = await readMark();
  const sql = await getSql();
  const rows = await sql<{
    principal: unknown;
    realized: unknown;
    exposure: unknown;
  }>`
    select principal, realized, exposure from allocations
    where id = ${id} and user_id = ${userId} and status = 'open'
  `;
  const row = rows[0];
  if (!row) throw new Error("No open AI session.");
  const principal = Number(num(row.principal));
  const realized = Number(num(row.realized));
  const exposure = Number(num(row.exposure));
  const roll = crypto.getRandomValues(new Uint8Array(1))[0] / 255 * 2 - 1;
  const raw = principal * exposure * roll * 0.35;
  const next = Math.min(Math.max(realized + raw, -principal), principal * 0.5);
  const delta = Number((next - realized).toFixed(6));
  const side: "buy" | "sell" = delta >= 0 ? "buy" : "sell";
  const price = mark.btcUsd * (1 + roll * 0.0012);
  const wallets = await walletsOf(sql, userId);
  const avail = Number(wallets.find((w) => w.asset === "USDT")?.available ?? "0");
  let applied = delta;
  if (delta < 0 && avail + delta < 0) applied = avail > 0 ? -avail : 0;
  applied = Number(applied.toFixed(6));
  if (Math.abs(applied) >= 0.000001) {
    await sql`
      update wallets
      set available = available + ${applied}::numeric
      where user_id = ${userId} and asset = 'USDT'
    `;
  }
  const amount = parseAmount(Math.max(Math.abs(delta), 0.01).toFixed(2), "USDT");
  const txId = qid("tx");
  const ref = makeRef();
  const meta = {
    strategy: "AI session",
    side,
    price: price.toFixed(2),
    memo: side === "buy" ? "AI buy fill" : "AI sell fill",
    value_date: new Date().toISOString().slice(0, 10),
    value_time: new Date().toISOString().slice(11, 16),
    session: id,
  };
  await sql`
    update allocations
    set realized = ${next}, last_mark = ${price}, pnl_posted = pnl_posted + ${applied}
    where id = ${id} and user_id = ${userId} and status = 'open'
  `;
  await sql`
    insert into transactions (
      id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
    ) values (
      ${txId}, ${userId}, 'ai_fill', 'USDT', ${amount}::numeric, ${side === "buy" ? "debit" : "credit"},
      'settled', ${ref}, ${side === "buy" ? "AI buy" : "AI sell"}, ${JSON.stringify(meta)}::jsonb, now()
    )
  `;
  return { side, delta: delta.toFixed(2), price };
}

export async function startAiSession(
  userId: string,
  input: { risk: "low" | "medium" | "high"; amount: string },
): Promise<{ id: string }> {
  const strategy = input.risk === "high" ? "delta" : input.risk === "medium" ? "rail" : "basis";
  const opened = await openAllocation(userId, strategy, input.amount);
  for (let i = 0; i < 4; i += 1) {
    await postAiFill(userId, opened.id);
  }
  return opened;
}

export async function pulseAi(
  userId: string,
  id: string,
): Promise<{ side: "buy" | "sell"; delta: string; price: number; realized: string }> {
  const profile = await ensureProfile(userId);
  if (profile.status === "frozen") {
    throw new Error("This account is frozen. Contact your officer before initiating a movement.");
  }
  const fill = await postAiFill(userId, id);
  const sql = await getSql();
  const rows = await sql<{ realized: unknown }>`
    select realized from allocations where id = ${id} and user_id = ${userId}
  `;
  return { ...fill, realized: num(rows[0]?.realized) };
}

export async function deskOverview(userId: string): Promise<DeskOverview> {
  await requireOfficer(userId);
  const sql = await getSql();
  const [counts, books, deposits, transfers, withdrawals, mark] = await Promise.all([
    sql<{ clients: unknown; frozen: unknown; restricted: unknown }>`
      select
        (select count(*) from profiles where role = 'client') as clients,
        (select count(*) from profiles where status = 'frozen') as frozen,
        (select count(*) from profiles where status = 'restricted') as restricted
    `,
    sql<{ usdt: unknown; btc: unknown }>`
      select
        coalesce((select sum(available + held + allocated) from wallets where asset = 'USDT'), 0) as usdt,
        coalesce((select sum(available + held + allocated) from wallets where asset = 'BTC'), 0) as btc
    `,
    sql<{ asset: string; amount: unknown }>`
      select asset, amount from deposit_requests where status = 'pending'
    `,
    sql<{ asset: string; amount: unknown }>`
      select asset, amount from transfer_requests where status = 'pending'
    `,
    sql<{ asset: string; amount: unknown }>`
      select asset, amount from withdrawal_requests where status = 'pending'
    `,
    readMark(),
  ]);
  let pendingUsd = 0;
  for (const row of [...deposits, ...transfers, ...withdrawals]) {
    const amount = Number(num(row.amount));
    pendingUsd += row.asset === "BTC" ? amount * mark.btcUsd : amount;
  }
  return {
    clients: asInt(counts[0]?.clients),
    frozen: asInt(counts[0]?.frozen),
    restricted: asInt(counts[0]?.restricted),
    pendingDeposits: deposits.length,
    pendingTransfers: transfers.length,
    pendingWithdrawals: withdrawals.length,
    pendingUsd,
    usdtBook: num(books[0]?.usdt),
    btcBook: num(books[0]?.btc),
    mark,
  };
}

export async function listClients(userId: string): Promise<ClientRow[]> {
  await requireOfficer(userId);
  const sql = await getSql();
  const rows = await sql<
    ProfileRow & { usdt: unknown; btc: unknown }
  >`
    select p.*,
      coalesce(u.available, 0) + coalesce(u.held, 0) + coalesce(u.allocated, 0) as usdt,
      coalesce(b.available, 0) + coalesce(b.held, 0) + coalesce(b.allocated, 0) as btc
    from profiles p
    left join wallets u on u.user_id = p.user_id and u.asset = 'USDT'
    left join wallets b on b.user_id = p.user_id and b.asset = 'BTC'
    order by case when p.role = 'admin' then 0 else 1 end, p.created_at desc
  `;
  return rows.map((row) => ({
    ...mapProfile(row),
    usdt: num(row.usdt),
    btc: num(row.btc),
  }));
}

export async function clientFile(officerId: string, targetId: string): Promise<ClientFile> {
  await requireOfficer(officerId);
  const sql = await getSql();
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${targetId}`;
  if (!rows[0]) throw new Error("Client not found.");
  await ensureWallets(sql, targetId);
  const [wallets, entries] = await Promise.all([
    walletsOf(sql, targetId),
    entriesOf(sql, targetId, true, 400),
  ]);
  return { profile: mapProfile(rows[0]), wallets, entries };
}

export async function setStatus(
  officerId: string,
  targetId: string,
  status: AccountStatus,
): Promise<void> {
  await requireOfficer(officerId);
  if (!["active", "restricted", "frozen"].includes(status)) throw new Error("Unknown status.");
  const sql = await getSql();
  const rows = await sql<{ n: unknown }>`
    update profiles set status = ${status}
    where user_id = ${targetId} and role = 'client'
    returning 1 as n
  `;
  if (!rows.length) throw new Error("That account cannot be changed.");
  const title =
    status === "frozen" ? "Account frozen" : status === "restricted" ? "Account restricted" : "Account restored";
  const body =
    status === "frozen"
      ? "Movements on this account are paused until an officer restores it."
      : status === "restricted"
        ? "Deposits can still be submitted. Transfers, withdrawals, and new mandates are paused."
        : "Full movement on this account has been restored.";
  await sql`
    insert into notifications (id, user_id, title, body) values (${qid("ntf")}, ${targetId}, ${title}, ${body})
  `;
}

export async function bulkStatus(
  officerId: string,
  userIds: string[],
  status: AccountStatus,
): Promise<number> {
  await requireOfficer(officerId);
  let n = 0;
  for (const id of userIds.slice(0, 200)) {
    try {
      await setStatus(officerId, id, status);
      n += 1;
    } catch {
      /* skip officers and missing rows */
    }
  }
  return n;
}

export async function pendingQueues(officerId: string): Promise<{
  deposits: PendingDeposit[];
  transfers: PendingTransfer[];
  withdrawals: PendingWithdrawal[];
}> {
  await requireOfficer(officerId);
  const sql = await getSql();
  const deposits = await sql<{
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    account_number: string;
    asset: string;
    amount: unknown;
    network: string;
    tx_reference: string | null;
    created_at: unknown;
  }>`
    select d.id, d.user_id, p.full_name, p.email, p.account_number, d.asset, d.amount,
      d.network, d.tx_reference, d.created_at
    from deposit_requests d
    join profiles p on p.user_id = d.user_id
    where d.status = 'pending'
    order by d.created_at asc
  `;
  const transfers = await sql<{
    id: string;
    asset: string;
    amount: unknown;
    memo: string | null;
    created_at: unknown;
    from_name: string;
    from_account: string;
    from_email: string;
    to_name: string;
    to_account: string;
    to_email: string;
  }>`
    select t.id, t.asset, t.amount, t.memo, t.created_at,
      f.full_name as from_name, f.account_number as from_account, f.email as from_email,
      r.full_name as to_name, r.account_number as to_account, r.email as to_email
    from transfer_requests t
    join profiles f on f.user_id = t.from_user_id
    join profiles r on r.user_id = t.to_user_id
    where t.status = 'pending'
    order by t.created_at asc
  `;
  const withdrawals = await sql<{
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    account_number: string;
    asset: string;
    amount: unknown;
    network: string;
    destination: string;
    reference: string | null;
    created_at: unknown;
  }>`
    select w.id, w.user_id, p.full_name, p.email, p.account_number, w.asset, w.amount,
      w.network, w.destination, t.reference, w.created_at
    from withdrawal_requests w
    join profiles p on p.user_id = w.user_id
    join transactions t on t.id = w.transaction_id
    where w.status = 'pending'
    order by w.created_at asc
  `;
  return {
    deposits: deposits.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      accountNumber: row.account_number,
      asset: row.asset === "BTC" ? "BTC" : "USDT",
      amount: num(row.amount),
      network: row.network,
      reference: row.tx_reference ?? "",
      createdAt: iso(row.created_at),
    })),
    transfers: transfers.map((row) => ({
      id: row.id,
      asset: row.asset === "BTC" ? "BTC" : "USDT",
      amount: num(row.amount),
      memo: row.memo ?? "",
      createdAt: iso(row.created_at),
      fromName: row.from_name,
      fromAccount: row.from_account,
      fromEmail: row.from_email,
      toName: row.to_name,
      toAccount: row.to_account,
      toEmail: row.to_email,
    })),
    withdrawals: withdrawals.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      accountNumber: row.account_number,
      asset: row.asset === "BTC" ? "BTC" : "USDT",
      amount: num(row.amount),
      network: row.network,
      destination: row.destination,
      reference: row.reference ?? "",
      createdAt: iso(row.created_at),
    })),
  };
}

export async function decideDeposit(
  officerId: string,
  id: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<void> {
  const officer = await requireOfficer(officerId);
  const decisionNote = note ? clean(note, 400) : "";
  const sql = await getSql();
  if (decision === "approved") {
    const noteId = qid("ntf");
    const rows = await sql<{ n: unknown }>`
      with approved as (
        update deposit_requests
        set status = 'approved', reviewed_by = ${officer.userId}, reviewed_at = now()
        where id = ${id} and status = 'pending'
        returning *
      ),
      wallet as (
        update wallets w
        set available = w.available + a.amount
        from approved a
        where w.user_id = a.user_id and w.asset = a.asset
        returning w.user_id
      ),
      tx as (
        update transactions t
        set status = 'settled',
            settled_at = now(),
            metadata = t.metadata || jsonb_build_object('decision_note', ${decisionNote})
        from approved a
        where t.id = a.transaction_id
        returning t.id
      ),
      note as (
        insert into notifications (id, user_id, title, body)
        select ${noteId}, a.user_id, 'Deposit posted',
          'Your deposit is on the ledger. Launch AI Trading Session is now open.'
        from approved a
        returning id
      )
      select (select count(*) from approved) as n
    `;
    if (asInt(rows[0]?.n) < 1) throw new Error("That deposit is no longer pending.");
    return;
  }
  const noteId = qid("ntf");
  const rows = await sql<{ n: unknown }>`
    with rejected as (
      update deposit_requests
      set status = 'rejected', reviewed_by = ${officer.userId}, reviewed_at = now()
      where id = ${id} and status = 'pending'
      returning *
    ),
    tx as (
      update transactions t
      set status = 'rejected',
          metadata = t.metadata || jsonb_build_object('decision_note', ${decisionNote})
      from rejected r
      where t.id = r.transaction_id
      returning t.id
    ),
    note as (
      insert into notifications (id, user_id, title, body)
      select ${noteId}, r.user_id, 'Deposit not posted',
        'Operations did not post this inbound item.'
      from rejected r
      returning id
    )
    select (select count(*) from rejected) as n
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("That deposit is no longer pending.");
}

export async function decideTransfer(
  officerId: string,
  id: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const officer = await requireOfficer(officerId);
  const sql = await getSql();
  if (decision === "approved") {
    const a = qid("ntf");
    const b = qid("ntf");
    const rows = await sql<{ n: unknown }>`
      with candidate as (
        select * from transfer_requests where id = ${id} and status = 'pending'
      ),
      sender as (
        update wallets w
        set held = w.held - c.amount
        from candidate c
        where w.user_id = c.from_user_id and w.asset = c.asset and w.held >= c.amount
        returning c.id, c.amount, c.asset, c.from_user_id, c.to_user_id, c.out_transaction_id, c.in_transaction_id
      ),
      receiver as (
        update wallets w
        set available = w.available + s.amount
        from sender s
        where w.user_id = s.to_user_id and w.asset = s.asset
        returning s.id
      ),
      mark as (
        update transfer_requests tr
        set status = 'approved', reviewed_by = ${officer.userId}, reviewed_at = now()
        from sender s
        where tr.id = s.id
        returning tr.id
      ),
      txs as (
        update transactions t
        set status = 'settled', settled_at = now()
        from sender s
        where t.id = s.out_transaction_id or t.id = s.in_transaction_id
        returning t.id
      ),
      notes as (
        insert into notifications (id, user_id, title, body)
        select ${a}, s.from_user_id, 'Transfer settled', 'Your internal transfer has been settled.'
        from sender s
        union all
        select ${b}, s.to_user_id, 'Funds received', 'An internal transfer has been posted to your ledger.'
        from sender s
        returning id
      )
      select (select count(*) from mark) as n
    `;
    if (asInt(rows[0]?.n) < 1) throw new Error("That transfer could not be settled.");
    return;
  }
  const a = qid("ntf");
  const b = qid("ntf");
  const rows = await sql<{ n: unknown }>`
    with candidate as (
      select * from transfer_requests where id = ${id} and status = 'pending'
    ),
    sender as (
      update wallets w
      set held = w.held - c.amount,
          available = w.available + c.amount
      from candidate c
      where w.user_id = c.from_user_id and w.asset = c.asset and w.held >= c.amount
      returning c.id, c.from_user_id, c.to_user_id, c.out_transaction_id, c.in_transaction_id
    ),
    mark as (
      update transfer_requests tr
      set status = 'rejected', reviewed_by = ${officer.userId}, reviewed_at = now()
      from sender s
      where tr.id = s.id
      returning tr.id
    ),
    txs as (
      update transactions t
      set status = 'rejected'
      from sender s
      where t.id = s.out_transaction_id or t.id = s.in_transaction_id
      returning t.id
    ),
    notes as (
      insert into notifications (id, user_id, title, body)
      select ${a}, s.from_user_id, 'Transfer returned',
        'An internal transfer was not settled. The reserved amount is available again.'
      from sender s
      union all
      select ${b}, s.to_user_id, 'Transfer declined', 'An inbound internal transfer was not settled.'
      from sender s
      returning id
    )
    select (select count(*) from mark) as n
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("That transfer could not be returned.");
}

export async function decideWithdrawal(
  officerId: string,
  id: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<void> {
  const officer = await requireOfficer(officerId);
  const decisionNote = note ? clean(note, 400) : "";
  const sql = await getSql();
  if (decision === "approved") {
    const noteId = qid("ntf");
    const rows = await sql<{ n: unknown }>`
      with candidate as (
        select * from withdrawal_requests where id = ${id} and status = 'pending'
      ),
      sender as (
        update wallets w
        set held = w.held - c.amount
        from candidate c
        where w.user_id = c.user_id and w.asset = c.asset and w.held >= c.amount
        returning c.id, c.user_id, c.transaction_id
      ),
      mark as (
        update withdrawal_requests wr
        set status = 'approved', reviewed_by = ${officer.userId}, reviewed_at = now()
        from sender s
        where wr.id = s.id
        returning wr.id
      ),
      tx as (
        update transactions t
        set status = 'settled',
            settled_at = now(),
            metadata = t.metadata || jsonb_build_object('decision_note', ${decisionNote})
        from sender s
        where t.id = s.transaction_id
        returning t.id
      ),
      note as (
        insert into notifications (id, user_id, title, body)
        select ${noteId}, s.user_id, 'Withdrawal released',
          'Operations released the outbound send. The reserved amount has left your ledger.'
        from sender s
        returning id
      )
      select (select count(*) from mark) as n
    `;
    if (asInt(rows[0]?.n) < 1) throw new Error("That withdrawal could not be released.");
    return;
  }
  const noteId = qid("ntf");
  const rows = await sql<{ n: unknown }>`
    with candidate as (
      select * from withdrawal_requests where id = ${id} and status = 'pending'
    ),
    sender as (
      update wallets w
      set held = w.held - c.amount,
          available = w.available + c.amount
      from candidate c
      where w.user_id = c.user_id and w.asset = c.asset and w.held >= c.amount
      returning c.id, c.user_id, c.transaction_id
    ),
    mark as (
      update withdrawal_requests wr
      set status = 'rejected', reviewed_by = ${officer.userId}, reviewed_at = now()
      from sender s
      where wr.id = s.id
      returning wr.id
    ),
    tx as (
      update transactions t
      set status = 'rejected',
          metadata = t.metadata || jsonb_build_object('decision_note', ${decisionNote})
      from sender s
      where t.id = s.transaction_id
      returning t.id
    ),
    note as (
      insert into notifications (id, user_id, title, body)
      select ${noteId}, s.user_id, 'Withdrawal returned',
        'Operations did not release this send. The reserved amount is available again.'
      from sender s
      returning id
    )
    select (select count(*) from mark) as n
  `;
  if (asInt(rows[0]?.n) < 1) throw new Error("That withdrawal could not be returned.");
}

export async function postLedger(
  officerId: string,
  input: {
    account: string;
    asset: Asset;
    direction: "credit" | "debit";
    amount: string;
    counterparty: string;
    institution: string;
    valueDate: string;
    valueTime: string;
    reference: string;
    internalNote: string;
  },
): Promise<{ transactionId: string }> {
  const officer = await requireOfficer(officerId);
  const amount = parseAmount(input.amount, input.asset);
  const counterparty = clean(input.counterparty, 120);
  const institution = clean(input.institution, 120);
  const reference = clean(input.reference, 140);
  const valueDate = clean(input.valueDate, 20);
  const valueTime = clean(input.valueTime, 12);
  const internalNote = input.internalNote ? clean(input.internalNote, 800) : "";
  if (!counterparty || !institution || !reference || !valueDate || !valueTime) {
    throw new Error("Counterparty, institution, date, time, and reference are required.");
  }
  const sql = await getSql();
  const key = clean(input.account, 160);
  const targets = await sql<ProfileRow>`
    select * from profiles
    where user_id = ${key} or account_number = ${key} or lower(email) = lower(${key})
    limit 1
  `;
  if (!targets[0]) throw new Error("No client matches that account.");
  const target = mapProfile(targets[0]);
  const txId = qid("tx");
  const noteId = qid("ntf");
  const kind = input.direction === "credit" ? "ledger_credit" : "ledger_debit";
  const delta = input.direction === "credit" ? amount : `-${amount}`;
  const metadata = {
    originating_institution: institution,
    value_date: valueDate,
    value_time: valueTime,
    internal_note: internalNote,
    officer: officer.email,
  };
  const rows = await sql<{ id: string | null }>`
    with w as (
      update wallets
      set available = available + ${delta}::numeric
      where user_id = ${target.userId} and asset = ${input.asset}
        and available + ${delta}::numeric >= 0
      returning user_id
    ),
    tx as (
      insert into transactions (
        id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata, settled_at
      )
      select ${txId}, ${target.userId}, ${kind}, ${input.asset}, ${amount}::numeric, ${input.direction},
        'settled', ${reference}, ${counterparty}, ${JSON.stringify(metadata)}::jsonb, now()
      from w
      returning id
    ),
    note as (
      insert into notifications (id, user_id, title, body)
      select ${noteId}, ${target.userId}, 'Ledger entry posted',
        ${"A ledger entry has been posted to your account. Reference " + reference + "."}
      from tx
      returning id
    )
    select (select id from tx) as id
  `;
  const transactionId = rows[0]?.id;
  if (!transactionId) {
    throw new Error("The entry was not posted. Check the asset balance if this is a debit.");
  }
  return { transactionId };
}

export async function sendNotice(
  officerId: string,
  input:
    | { audience: "all"; title: string; body: string }
    | { audience: "ids"; userIds: string[]; title: string; body: string }
    | { audience: "account"; account: string; title: string; body: string },
): Promise<{ sent: number }> {
  await requireOfficer(officerId);
  const title = clean(input.title, 140);
  const body = clean(input.body, 2000);
  if (!title || !body) throw new Error("A notice needs a title and a message.");
  const sql = await getSql();
  if (input.audience === "all") {
    const rows = await sql<{ n: unknown }>`
      with ins as (
        insert into notifications (id, user_id, title, body)
        select 'ntf_' || substr(md5(random()::text || user_id), 1, 18), user_id, ${title}, ${body}
        from profiles where role = 'client'
        returning id
      )
      select count(*) as n from ins
    `;
    return { sent: asInt(rows[0]?.n) };
  }
  if (input.audience === "account") {
    const key = clean(input.account, 160);
    const targets = await sql<{ user_id: string }>`
      select user_id from profiles
      where role = 'client' and (account_number = ${key} or lower(email) = lower(${key}) or user_id = ${key})
      limit 1
    `;
    if (!targets[0]) throw new Error("No client matches that account.");
    await sql`
      insert into notifications (id, user_id, title, body)
      values (${qid("ntf")}, ${targets[0].user_id}, ${title}, ${body})
    `;
    return { sent: 1 };
  }
  const ids = [...new Set(input.userIds)].slice(0, 200);
  let sent = 0;
  for (const uid of ids) {
    const ok = await sql<{ user_id: string }>`
      select user_id from profiles where user_id = ${uid} and role = 'client'
    `;
    if (!ok.length) continue;
    await sql`
      insert into notifications (id, user_id, title, body)
      values (${qid("ntf")}, ${uid}, ${title}, ${body})
    `;
    sent += 1;
  }
  return { sent };
}

export async function setBalance(
  officerId: string,
  input: { account: string; asset: Asset; available: string },
): Promise<{ available: string; transactionId: string | null }> {
  const officer = await requireOfficer(officerId);
  const minor = toMinor(input.available.trim(), input.asset);
  if (minor < 0n) throw new Error("Balance cannot be negative.");
  const target = fromMinor(minor, input.asset);
  const sql = await getSql();
  const key = clean(input.account, 160);
  const targets = await sql<ProfileRow>`
    select * from profiles
    where user_id = ${key} or account_number = ${key} or lower(email) = lower(${key})
    limit 1
  `;
  if (!targets[0]) throw new Error("No client matches that account.");
  const profile = mapProfile(targets[0]);
  await ensureWallets(sql, profile.userId);
  const wallets = await walletsOf(sql, profile.userId);
  const current = wallets.find((w) => w.asset === input.asset)?.available ?? "0";
  const deltaMinor = toMinor(target, input.asset) - toMinor(current, input.asset);
  if (deltaMinor === 0n) return { available: current, transactionId: null };
  const direction = deltaMinor > 0n ? "credit" : "debit";
  const amount = fromMinor(deltaMinor > 0n ? deltaMinor : -deltaMinor, input.asset);
  const posted = await postLedger(officer.userId, {
    account: profile.userId,
    asset: input.asset,
    direction,
    amount,
    counterparty: profile.fullName,
    institution: "Aether Markets",
    valueDate: new Date().toISOString().slice(0, 10),
    valueTime: new Date().toISOString().slice(11, 16),
    reference: makeRef(),
    internalNote: "Direct balance adjustment",
  });
  return { available: target, transactionId: posted.transactionId };
}

export async function draftNote(
  userId: string,
  intent: string,
): Promise<{ available: boolean; text: string; error?: string }> {
  const profile = await ensureProfile(userId);
  if (profile.status === "frozen") {
    throw new Error("This account is frozen. Contact your officer before initiating a movement.");
  }
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { available: false, text: "" };
  const sql = await getSql();
  const wallets = await walletsOf(sql, userId);
  const open = await listAllocations(userId);
  const mark = await readMark();
  const brief = clean(intent, 500);
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 320,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are the research desk at a private digital-asset brokerage. Write a concise sizing note in plain prose, under 130 words. No hype, no bullet icons, no promises of profit. State assumptions. End with one sentence that the note is desk research and not a solicitation.",
        },
        {
          role: "user",
          content: JSON.stringify({
            client: profile.fullName,
            status: profile.status,
            mark,
            wallets,
            openMandates: open.filter((a) => a.status === "open"),
            intent: brief,
          }),
        },
      ],
    }),
  });
  if (!res.ok) return { available: true, text: "", error: "The research desk did not respond. Try again shortly." };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return { available: true, text: "", error: "The research desk returned an empty note." };
  return { available: true, text };
}
