import type { Asset } from "@/lib/money";

export type Role = "client" | "admin";
export type AccountStatus = "active" | "restricted" | "frozen";
export type EntityType = "individual" | "institution";

export type ProfileView = {
  userId: string;
  fullName: string;
  email: string;
  accountNumber: string;
  role: Role;
  status: AccountStatus;
  entityType: EntityType;
  createdAt: string;
};

export type WalletView = {
  asset: Asset;
  network: string;
  available: string;
  held: string;
  allocated: string;
};

export type LedgerEntry = {
  id: string;
  userId: string;
  kind: string;
  asset: Asset;
  amount: string;
  direction: "credit" | "debit";
  status: string;
  reference: string;
  counterparty: string;
  network: string;
  institution: string;
  valueDate: string;
  valueTime: string;
  memo: string;
  decisionNote: string;
  destination: string;
  strategy: string;
  internalNote?: string;
  createdAt: string;
  settledAt: string | null;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type AllocationView = {
  id: string;
  strategy: string;
  strategyName: string;
  asset: Asset;
  principal: string;
  realized: string;
  exposure: string;
  entryMark: string;
  lastMark: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
};

export type Mark = {
  btcUsd: number;
  changePct: number;
  source: "live" | "reference";
  asOf: string;
};

export type PortalHome = {
  profile: ProfileView;
  wallets: WalletView[];
  recent: LedgerEntry[];
  notices: Notice[];
  unread: number;
  mark: Mark;
  tradingUnlocked: boolean;
  openPnl: string;
};

export type ClientRow = ProfileView & {
  usdt: string;
  btc: string;
};

export type PendingDeposit = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  accountNumber: string;
  asset: Asset;
  amount: string;
  network: string;
  reference: string;
  createdAt: string;
};

export type PendingTransfer = {
  id: string;
  asset: Asset;
  amount: string;
  memo: string;
  createdAt: string;
  fromName: string;
  fromAccount: string;
  fromEmail: string;
  toName: string;
  toAccount: string;
  toEmail: string;
};

export type PendingWithdrawal = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  accountNumber: string;
  asset: Asset;
  amount: string;
  network: string;
  destination: string;
  reference: string;
  createdAt: string;
};

export type DeskOverview = {
  clients: number;
  frozen: number;
  restricted: number;
  pendingDeposits: number;
  pendingTransfers: number;
  pendingWithdrawals: number;
  pendingUsd: number;
  usdtBook: string;
  btcBook: string;
  mark: Mark;
};

export type ReceiptView = {
  profile: ProfileView;
  entry: LedgerEntry;
};

export type ClientFile = {
  profile: ProfileView;
  wallets: WalletView[];
  entries: LedgerEntry[];
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Quote = {
  id: string;
  symbol: string;
  name: string;
  usd: number;
  changePct: number;
};
