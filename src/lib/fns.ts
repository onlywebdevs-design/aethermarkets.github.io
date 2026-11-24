import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Asset } from "@/lib/money";
import type {
  AccountStatus,
  AllocationView,
  Candle,
  ClientFile,
  ClientRow,
  DeskOverview,
  LedgerEntry,
  Mark,
  Notice,
  PortalHome,
  ProfileView,
  Quote,
  ReceiptView,
} from "@/lib/types";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error("Check the form and try again.");
  return result.data;
}

const assetSchema = z.enum(["USDT", "BTC"]);

export const warmDesk = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureDeskPrincipal } = await import("@/lib/desk-bootstrap.server");
  try {
    await ensureDeskPrincipal();
  } catch (error) {
    console.error("[desk] bootstrap", error);
  }
  return null;
});

export const getMark = createServerFn({ method: "GET" }).handler(async (): Promise<Mark> => {
  const { readMark } = await import("@/lib/market.server");
  return readMark();
});

export const getQuotes = createServerFn({ method: "GET" }).handler(async (): Promise<Quote[]> => {
  const { readQuotes } = await import("@/lib/market.server");
  return readQuotes();
});

export const getCandles = createServerFn({ method: "GET" })
  .validator((asset: unknown) => (asset === "ETH" ? "ETH" : "BTC"))
  .handler(async ({ data }): Promise<Candle[]> => {
    const { readCandles } = await import("@/lib/market.server");
    return readCandles(data);
  });

export const getPortalHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PortalHome> => {
    const { portalHome } = await import("@/lib/ledger.server");
    return portalHome(context.userId);
  });

export const completeProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        fullName: z.string(),
        entityType: z.enum(["individual", "institution"]),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<ProfileView> => {
    const { setEntity } = await import("@/lib/ledger.server");
    return setEntity(context.userId, data.fullName, data.entityType);
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LedgerEntry[]> => {
    const { listEntries } = await import("@/lib/ledger.server");
    return listEntries(context.userId);
  });

export const getReceipt = createServerFn({ method: "GET" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || id.length < 4 || id.length > 80) throw new Error("Receipt not found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<ReceiptView> => {
    const { readReceipt } = await import("@/lib/ledger.server");
    return readReceipt(context.userId, data);
  });

export const listNotices = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Notice[]> => {
    const { listNotices: load } = await import("@/lib/ledger.server");
    return load(context.userId);
  });

export const markNoticeRead = createServerFn({ method: "POST" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || !id) throw new Error("Notice not found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { markNotice } = await import("@/lib/ledger.server");
    await markNotice(context.userId, data);
    return { ok: true as const };
  });

export const markAllNoticesRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { markAllNotices } = await import("@/lib/ledger.server");
    await markAllNotices(context.userId);
    return { ok: true as const };
  });

export const submitDeposit = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        asset: assetSchema,
        amount: z.string(),
        reference: z.string().optional().default(""),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { submitDeposit: run } = await import("@/lib/ledger.server");
    return run(context.userId, data);
  });

export const submitTransfer = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        asset: assetSchema,
        amount: z.string(),
        recipient: z.string(),
        memo: z.string().optional().default(""),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { submitTransfer: run } = await import("@/lib/ledger.server");
    return run(context.userId, data);
  });

export const submitWithdrawal = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        asset: assetSchema,
        amount: z.string(),
        destination: z.string(),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { submitWithdrawal: run } = await import("@/lib/ledger.server");
    return run(context.userId, data);
  });

export const executeTrade = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(z.object({ side: z.enum(["buy", "sell"]), notional: z.string() }), input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { executeTrade: run } = await import("@/lib/ledger.server");
    return run(context.userId, data);
  });

export const startAiSession = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(z.object({ risk: z.enum(["low", "medium", "high"]), amount: z.string() }), input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { startAiSession: run } = await import("@/lib/ledger.server");
    return run(context.userId, data);
  });

export const pulseAi = createServerFn({ method: "POST" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || !id) throw new Error("Session not found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { pulseAi: run } = await import("@/lib/ledger.server");
    return run(context.userId, data);
  });

export const listAllocations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AllocationView[]> => {
    const { listAllocations: load } = await import("@/lib/ledger.server");
    return load(context.userId);
  });

export const openAllocation = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(z.object({ strategy: z.enum(["basis", "delta", "rail"]), amount: z.string() }), input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { openAllocation: run } = await import("@/lib/ledger.server");
    return run(context.userId, data.strategy, data.amount);
  });

export const markAllocation = createServerFn({ method: "POST" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || !id) throw new Error("Mandate not found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { markAllocation: run } = await import("@/lib/ledger.server");
    return run(context.userId, data);
  });

export const closeAllocation = createServerFn({ method: "POST" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || !id) throw new Error("Mandate not found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { closeAllocation: run } = await import("@/lib/ledger.server");
    await run(context.userId, data);
    return { ok: true as const };
  });

export const draftSizingNote = createServerFn({ method: "POST" })
  .validator((intent: unknown) => {
    if (typeof intent !== "string") throw new Error("Describe the allocation.");
    return intent;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { draftNote } = await import("@/lib/ledger.server");
    return draftNote(context.userId, data);
  });

export const getDeskOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskOverview> => {
    const { deskOverview } = await import("@/lib/ledger.server");
    return deskOverview(context.userId);
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ClientRow[]> => {
    const { listClients: load } = await import("@/lib/ledger.server");
    return load(context.userId);
  });

export const getClientFile = createServerFn({ method: "GET" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || !id) throw new Error("Client not found.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<ClientFile> => {
    const { clientFile } = await import("@/lib/ledger.server");
    return clientFile(context.userId, data);
  });

export const setClientStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        userId: z.string().min(1),
        status: z.enum(["active", "restricted", "frozen"]),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { setStatus } = await import("@/lib/ledger.server");
    await setStatus(context.userId, data.userId, data.status as AccountStatus);
    return { ok: true as const };
  });

export const bulkClientStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        userIds: z.array(z.string()).min(1).max(200),
        status: z.enum(["active", "restricted", "frozen"]),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { bulkStatus } = await import("@/lib/ledger.server");
    const updated = await bulkStatus(context.userId, data.userIds, data.status);
    return { updated };
  });

export const getPending = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { pendingQueues } = await import("@/lib/ledger.server");
    return pendingQueues(context.userId);
  });

export const reviewDeposit = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        id: z.string().min(1),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional().default(""),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { decideDeposit } = await import("@/lib/ledger.server");
    await decideDeposit(context.userId, data.id, data.decision, data.note);
    return { ok: true as const };
  });

export const reviewTransfer = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(z.object({ id: z.string().min(1), decision: z.enum(["approved", "rejected"]) }), input),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { decideTransfer } = await import("@/lib/ledger.server");
    await decideTransfer(context.userId, data.id, data.decision);
    return { ok: true as const };
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        id: z.string().min(1),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional().default(""),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { decideWithdrawal } = await import("@/lib/ledger.server");
    await decideWithdrawal(context.userId, data.id, data.decision, data.note);
    return { ok: true as const };
  });

export const postLedgerEntry = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        account: z.string(),
        asset: assetSchema,
        direction: z.enum(["credit", "debit"]),
        amount: z.string(),
        counterparty: z.string(),
        institution: z.string(),
        valueDate: z.string(),
        valueTime: z.string(),
        reference: z.string(),
        internalNote: z.string().optional().default(""),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { postLedger } = await import("@/lib/ledger.server");
    return postLedger(context.userId, { ...data, asset: data.asset as Asset });
  });

const noticeSchema = z.discriminatedUnion("audience", [
  z.object({ audience: z.literal("all"), title: z.string(), body: z.string() }),
  z.object({
    audience: z.literal("ids"),
    userIds: z.array(z.string()).min(1).max(200),
    title: z.string(),
    body: z.string(),
  }),
  z.object({ audience: z.literal("account"), account: z.string(), title: z.string(), body: z.string() }),
]);

export const sendClientNotice = createServerFn({ method: "POST" })
  .validator((input: unknown) => parse(noticeSchema, input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { sendNotice } = await import("@/lib/ledger.server");
    return sendNotice(context.userId, data);
  });

export const setClientBalance = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(
      z.object({
        account: z.string(),
        asset: assetSchema,
        available: z.string(),
      }),
      input,
    ),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { setBalance } = await import("@/lib/ledger.server");
    return setBalance(context.userId, { ...data, asset: data.asset as Asset });
  });
