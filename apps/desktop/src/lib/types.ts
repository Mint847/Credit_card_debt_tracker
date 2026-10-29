// The account data shapes, as the core stores them (see cleanCard / cleanSpace in packages/core)
export type EntryType = 'purchase' | 'payment' | 'refund' | 'adjustment';

export interface Entry {
  id: string;
  date: string;
  type: EntryType;
  amount: number;
  category?: string;
  merchant?: string;
  note?: string;
  source: 'manual' | 'sms' | 'recurring' | 'system' | 'space';
  applied?: number;
  createdAt?: number;
  recurringId?: string;
  spaceId?: string;
}

export interface Recurring {
  id: string;
  name: string;
  amount: number;
  day: number;
  startDate: string;
  endDate?: string | null;
  paused?: boolean;
  cancelled?: boolean;
  lastPosted?: string | null;
  skipped?: string[];
  category: string;
}

export interface Statement {
  date: string;
  due: string;
  balance: number;
  minDue: number;
  answered?: 'no';
}

export interface Card {
  id: string;
  bank: string;
  nick: string;
  limit: number;
  balance: number;
  color: string;
  issuer?: string;
  apr?: number;
  isZeroPercent?: boolean;
  minPct?: number;
  minFloor?: number;
  statementDay?: number;
  dueDay?: number;
  targetPayment?: number;
  last4?: string;
  cycleTrackedFrom?: string;
  ledger?: Entry[];
  recurring?: Recurring[];
  budgets?: Record<string, number>;
  statements?: Statement[];
  ledgerArchive?: Record<string, { spent: number; payments: number; byCategory?: Record<string, number> }>;
}

export interface SpaceItem {
  id: string;
  date: string;
  type: 'deposit' | 'withdraw' | 'card-payment';
  amount: number;
  note?: string;
  cardId?: string;
}

export interface Space {
  id: string;
  name: string;
  targetLKR: number;
  currentLKR: number;
  targetDate: string;
  color: string;
  history: SpaceItem[];
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  income: string;
}

export type Strategy = 'avalanche' | 'snowball';
