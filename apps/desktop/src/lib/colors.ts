// Category colours: the 500 shade of each category's bar colour in the phone app (SPEND_CATEGORIES)
export const CATEGORY_HEX: Record<string, string> = {
  groceries: '#10b981', dining: '#a855f7', fuel: '#f59e0b', shopping: '#0ea5e9', bills: '#64748b',
  subscriptions: '#6366f1', travel: '#06b6d4', health: '#f43f5e', entertainment: '#d946ef', education: '#14b8a6', other: '#94a3b8'
};
export const categoryHex = (k: string | undefined) => CATEGORY_HEX[k || 'other'] || CATEGORY_HEX.other;
