// Backup and restore: the backup file's contents, what a backup would add, and the restore itself.
// Moved from the App closure in index.html (Phase 1). File reading/downloading stays in each UI.
import { BACKUP_VERSION } from './domain.js';

function copy(v) { return JSON.parse(JSON.stringify(v)); }

// The JSON a "Download a backup" saves
export function buildBackupDoc(userData, strategy, cards, spaces) {
  var u = userData || {};
  return { app: 'serendib', version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    profile: { firstName: u.firstName || '', lastName: u.lastName || '', income: u.income || '', strategy: strategy || 'avalanche' },
    cards: copy(cards), spaces: copy(spaces) };
}

// "3 cards · 1 space · 42 entries"
export function countsText(cs, ss) {
  var entries = cs.reduce(function (n, c) { return n + ((c.ledger || []).length); }, 0);
  return cs.length + (cs.length === 1 ? ' card' : ' cards') + ' · ' + ss.length + (ss.length === 1 ? ' space' : ' spaces') + ' · ' + entries + (entries === 1 ? ' entry' : ' entries');
}

// Cards and spaces in a (validated) backup that this device doesn't have yet
export function restoreDiff(cards, spaces, data) {
  var haveC = {}, haveS = {};
  cards.forEach(function (c) { haveC[String(c.id)] = true; });
  spaces.forEach(function (s) { haveS[String(s.id)] = true; });
  return {
    newCards: data.cards.filter(function (c) { return !haveC[c.id]; }),
    newSpaces: data.spaces.filter(function (s) { return !haveS[s.id]; })
  };
}

// What the account becomes after a restore ("merge" adds what's missing, otherwise replace),
// and a copy of how it was before (for Undo and the safety copy)
export function planRestore(userData, strategy, cards, spaces, data, mode, newCards, newSpaces) {
  var before = copy(Object.assign({}, userData || {}, { cards: cards, spaces: spaces, strategy: strategy }));
  var next = Object.assign({}, userData || {});
  if (mode === 'merge') {
    next.cards = cards.concat(copy(newCards));
    next.spaces = spaces.concat(copy(newSpaces));
  } else {
    next.cards = copy(data.cards);
    next.spaces = copy(data.spaces);
    Object.keys(data.profile).forEach(function (k) { if (data.profile[k] !== '') next[k] = data.profile[k]; });
  }
  return { before: before, next: next };
}

// A safety copy kept on this device, in backup form (so it goes through the same checks and preview)
export function safetyCopyToBackup(c) {
  return { app: 'serendib', version: BACKUP_VERSION, exportedAt: new Date(c.at).toISOString(),
    profile: { firstName: c.data.firstName, lastName: c.data.lastName, income: c.data.income, strategy: c.data.strategy },
    cards: c.data.cards, spaces: c.data.spaces };
}

/* The restore screen's wording and checks (shared so both apps say the same) */
export var BACKUP_MAX_BYTES = 2 * 1024 * 1024;
export function backupFileName(todayStr) { return 'serendib-backup-' + todayStr + '.json'; }
function when(v) {
  var d = new Date(v);
  return isNaN(d) ? null : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function backupWhen(exportedAt) { return (exportedAt && when(exportedAt)) || 'an unknown date'; }
export function safetyCopyWhen(at) { return when(at) || ''; }
// "Add what's missing": what it would add, or that there's nothing to add
export function restoreMergeLine(newCards, newSpaces) {
  if (!newCards.length && !newSpaces.length) return 'Everything in this backup is already here.';
  return 'Adds ' + newCards.length + (newCards.length === 1 ? ' card' : ' cards') + ' and ' + newSpaces.length + (newSpaces.length === 1 ? ' space' : ' spaces') + ' you don’t have. Nothing else changes.';
}
export function restoreReplaceWarning(cards, spaces) {
  return 'This replaces your ' + countsText(cards, spaces) + '. You can undo straight after.';
}
export function restoreDoneText(mode, newCards, newSpaces) {
  return mode === 'merge'
    ? 'Added ' + newCards.length + (newCards.length === 1 ? ' card' : ' cards') + ' and ' + newSpaces.length + (newSpaces.length === 1 ? ' space' : ' spaces')
    : 'Backup restored';
}
