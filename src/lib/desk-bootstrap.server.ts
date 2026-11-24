import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { DESK_EMAIL } from "@/lib/desk.constants.server";

const DESK_PASSWORD = "Tradrzadmin@123";
const DESK_NAME = "Operations Desk";

let ready = false;

function id(): string {
  return crypto.randomUUID();
}

async function accountNumber(): Promise<string> {
  const sql = await getSql();
  for (let i = 0; i < 6; i += 1) {
    const n = `AM-${Math.floor(100000 + Math.random() * 900000)}`;
    const hit = await sql<{ n: number }>`select 1 as n from profiles where account_number = ${n}`;
    if (!hit.length) return n;
  }
  return `AM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function ensureDeskPrincipal(): Promise<void> {
  if (ready) return;
  const sql = await getSql();
  const email = DESK_EMAIL.toLowerCase();
  let rows = await sql<{ id: string }>`select id from "user" where lower(email) = ${email} limit 1`;
  let userId = rows[0]?.id;
  if (!userId) {
    userId = id();
    try {
      await sql`
        insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
        values (${userId}, ${DESK_NAME}, ${DESK_EMAIL}, true, now(), now())
      `;
    } catch {
      rows = await sql<{ id: string }>`select id from "user" where lower(email) = ${email} limit 1`;
      userId = rows[0]?.id;
    }
  }
  if (!userId) return;

  const accounts = await sql<{ id: string }>`
    select id from "account" where "userId" = ${userId} and "providerId" = 'credential' limit 1
  `;
  if (!accounts.length) {
    const hash = await hashPassword(DESK_PASSWORD);
    await sql`
      insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
      values (${id()}, ${userId}, 'credential', ${userId}, ${hash}, now(), now())
    `;
  }

  const profiles = await sql<{ user_id: string }>`select user_id from profiles where user_id = ${userId}`;
  if (!profiles.length) {
    const number = await accountNumber();
    await sql`
      insert into profiles (user_id, full_name, email, account_number, role, status, entity_type)
      values (${userId}, ${DESK_NAME}, ${DESK_EMAIL}, ${number}, 'admin', 'active', 'institution')
    `;
  } else {
    await sql`update profiles set role = 'admin', email = ${DESK_EMAIL} where user_id = ${userId}`;
  }

  await sql`
    insert into wallets (id, user_id, asset, network)
    values (${id()}, ${userId}, 'USDT', 'Arbitrum')
    on conflict (user_id, asset) do nothing
  `;
  await sql`
    insert into wallets (id, user_id, asset, network)
    values (${id()}, ${userId}, 'BTC', 'Bitcoin')
    on conflict (user_id, asset) do nothing
  `;
  await ensureSamplePending(sql);
  ready = true;
}

async function ensureSamplePending(sql: Awaited<ReturnType<typeof getSql>>): Promise<void> {
  const existing = await sql<{ id: string }>`
    select id from deposit_requests where tx_reference = 'AE-SAMPLE01' limit 1
  `;
  if (existing.length) return;
  const email = "sample.client@aethermarkets.app";
  let rows = await sql<{ id: string }>`select id from "user" where lower(email) = ${email} limit 1`;
  let sampleId = rows[0]?.id;
  if (!sampleId) {
    sampleId = id();
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${sampleId}, 'Marcus Hale', ${email}, true, now(), now())
    `;
  }
  const profiles = await sql<{ user_id: string }>`select user_id from profiles where user_id = ${sampleId}`;
  if (!profiles.length) {
    const number = await accountNumber();
    await sql`
      insert into profiles (user_id, full_name, email, account_number, role, status, entity_type)
      values (${sampleId}, 'Marcus Hale', ${email}, ${number}, 'client', 'active', 'individual')
    `;
  }
  await sql`
    insert into wallets (id, user_id, asset, network)
    values (${id()}, ${sampleId}, 'USDT', 'Arbitrum')
    on conflict (user_id, asset) do nothing
  `;
  await sql`
    insert into wallets (id, user_id, asset, network)
    values (${id()}, ${sampleId}, 'BTC', 'Bitcoin')
    on conflict (user_id, asset) do nothing
  `;
  const txId = id();
  const depId = id();
  const metadata = {
    originating_institution: "Aether Treasury",
    network: "Arbitrum",
    value_date: new Date().toISOString().slice(0, 10),
    value_time: "09:41",
    tx_reference: "AE-SAMPLE01",
  };
  await sql`
    insert into transactions (
      id, user_id, kind, asset, amount, direction, status, reference, counterparty, metadata
    ) values (
      ${txId}, ${sampleId}, 'deposit', 'USDT', 250, 'credit', 'pending',
      'AE-SAMPLE01', 'Aether Treasury', ${JSON.stringify(metadata)}::jsonb
    )
  `;
  await sql`
    insert into deposit_requests (
      id, user_id, transaction_id, asset, amount, network, tx_reference, status
    ) values (
      ${depId}, ${sampleId}, ${txId}, 'USDT', 250, 'Arbitrum', 'AE-SAMPLE01', 'pending'
    )
  `;
}
