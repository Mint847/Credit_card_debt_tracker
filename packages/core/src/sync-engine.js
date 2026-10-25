// Account sync engine: what this device changed (edit times, deletions), its copy of the account,
// merging with the cloud's or another device's copy, and saving as a Firestore transaction.
// Moved from the App closure in index.html (Phase 1). The UI plugs in through `io`, so the phone app
// and the desktop app run exactly the same rules:
//   getUser()      the signed-in Firebase user (or null)
//   getData()      the account's settings object (window.currentUserData in the phone app), or null
//   setData(d)     replace that object
//   getCards()     this device's cards array;  getSpaces(): its spaces array
//   getFields()    { firstName, lastName, income, strategy } as the user currently sees them
//   getDb()        the Firestore instance (or undefined before it's ready)
//   applyDoc(doc)  load a merged copy into the UI (the phone app's setCloudData)
//   onCloudMerged() the cloud held something this device didn't: redraw
import { syncSig, mergeAccount, mergeTombstones, saveSafetyCopy, SYNC_FIELDS } from './domain.js';

export function createSyncEngine(io) {
  // True once this account's cloud document has been read (or created). Until then saves
  // go only to this account's local cache, so stale or empty data can't overwrite the cloud.
  var cloudReady = false;
  // lastUpdated stamps of this device's recent cloud writes (their echo is not a remote change)
  var ownWrites = [];
  // What each card, space and setting looked like when last loaded or saved, so a save can tell
  // what this device actually changed (edit times) and deleted (tombstones)
  var syncKnown = { cards: {}, spaces: {}, fields: {} };

  function data() {
    var u = io.getData();
    if (!u) { u = {}; io.setData(u); }
    return u;
  }

  function rememberSyncState() {
    syncKnown = { cards: {}, spaces: {}, fields: io.getFields() };
    io.getCards().forEach(function (c) { if (c && c.id !== undefined && c.id !== null) syncKnown.cards[String(c.id)] = syncSig(c); });
    io.getSpaces().forEach(function (s) { if (s && s.id !== undefined && s.id !== null) syncKnown.spaces[String(s.id)] = syncSig(s); });
  }

  function stampItems(list, known, tombs, now) {
    var present = {};
    list.forEach(function (item) {
      if (!item || item.id === undefined || item.id === null) return;
      var id = String(item.id), sig = syncSig(item);
      present[id] = true;
      if (known[id] !== sig) { item.updatedAt = now; known[id] = sig; }
    });
    Object.keys(known).forEach(function (id) {
      if (!present[id]) { tombs[id] = now; delete known[id]; }
    });
  }

  // This device's copy of the account, with its own edits and deletions stamped
  function buildUserDoc() {
    var user = io.getUser();
    var u = data();
    var cards = io.getCards(), spaces = io.getSpaces();
    var now = Date.now();
    if (!u.deletedCards || typeof u.deletedCards !== 'object') u.deletedCards = {};
    if (!u.deletedSpaces || typeof u.deletedSpaces !== 'object') u.deletedSpaces = {};
    if (!u.fieldTimes || typeof u.fieldTimes !== 'object') u.fieldTimes = {};
    stampItems(cards, syncKnown.cards, u.deletedCards, now);
    stampItems(spaces, syncKnown.spaces, u.deletedSpaces, now);
    var f = io.getFields();
    SYNC_FIELDS.forEach(function (k) {
      if (syncKnown.fields[k] !== f[k]) {
        u.fieldTimes[k] = now;
        syncKnown.fields[k] = f[k];
        if (u.defaults) delete u.defaults[k];
      }
    });
    if (u.defaults && !Object.keys(u.defaults).length) delete u.defaults;
    u.income = f.income;
    u.deletedCards = mergeTombstones(u.deletedCards, null, now);
    u.deletedSpaces = mergeTombstones(u.deletedSpaces, null, now);
    var doc = {
      email: ((user && user.email) || '').toLowerCase().trim(),
      uid: user ? user.uid : '',
      firstName: f.firstName,
      lastName: f.lastName,
      cards: cards || [],
      spaces: spaces || [],
      income: f.income,
      strategy: f.strategy,
      onboarding: u.onboarding || {},
      hasCompletedTour: !!(u.hasCompletedTour || (u.onboarding && u.onboarding.welcomeDone)),
      deletedCards: Object.assign({}, u.deletedCards),
      deletedSpaces: Object.assign({}, u.deletedSpaces),
      fieldTimes: Object.assign({}, u.fieldTimes),
      lastUpdated: now
    };
    if (u.defaults) doc.defaults = Object.assign({}, u.defaults);
    return doc;
  }

  function syncContentKey(d) {
    return JSON.stringify([d.cards || [], d.spaces || [], SYNC_FIELDS.map(function (k) { return d[k] === undefined ? '' : d[k]; })]);
  }

  function writeLocalCache(uid, doc) {
    try { localStorage.setItem('stitch_user_uid_' + uid, JSON.stringify(doc)); } catch (e) { console.warn("Local cache write failed:", e); }
  }

  // Bring another copy of the account (the cloud's, or another device's live change) into this
  // device by merging it with what is here; anything this device has that the other lacks is saved back.
  function mergeIntoApp(other) {
    var user = io.getUser();
    if (!user || !other) return null;
    var lastSaved = Number((io.getData() || {}).lastUpdated) || 0;
    var mine = buildUserDoc();
    // Judge this copy by when it was last saved (not now), so a newer copy from elsewhere wins ties
    mine.lastUpdated = lastSaved;
    var merged = mergeAccount(mine, other) || mine;
    merged.email = mine.email;
    merged.uid = mine.uid;
    var lostItems = (mine.cards || []).some(function (c) { return !merged.cards.some(function (m) { return String(m.id) === String(c.id); }); }) ||
      (mine.spaces || []).some(function (s) { return !merged.spaces.some(function (m) { return String(m.id) === String(s.id); }); });
    if (lostItems) saveSafetyCopy(user.uid, mine, 'Before a deletion from another device');
    if (syncContentKey(merged) !== syncContentKey(mine)) {
      io.applyDoc(merged);
      writeLocalCache(user.uid, merged);
    }
    if (syncContentKey(merged) !== syncContentKey(other) && cloudReady) saveUserData();
    return merged;
  }

  function saveUserData() {
    var user = io.getUser();
    if (!user) return Promise.resolve();
    var userData = buildUserDoc();
    if (io.getData()) io.getData().lastUpdated = userData.lastUpdated;

    // 1. This account's own cache on this device (fast start, and offline edits)
    writeLocalCache(user.uid, userData);

    // 2. Cloud Firestore, only once this account's cloud copy has been loaded. The write merges
    //    with whatever the cloud holds right now, so another device's cards are never overwritten.
    var db = io.getDb();
    if (!cloudReady || typeof db === 'undefined' || db === null) return Promise.resolve();
    var ref = db.collection("users").doc(user.uid);
    var noteOwn = function (stamp) { ownWrites.push(stamp); if (ownWrites.length > 50) ownWrites.shift(); };
    var write = typeof db.runTransaction === 'function'
      ? db.runTransaction(function (t) {
          return t.get(ref).then(function (snap) {
            var merged = mergeAccount(userData, snap.exists ? (snap.data() || {}) : null) || userData;
            merged.lastUpdated = Math.max(userData.lastUpdated, Number(merged.lastUpdated) || 0);
            merged.email = userData.email;
            merged.uid = userData.uid;
            noteOwn(merged.lastUpdated);
            t.set(ref, merged);
            return merged;
          });
        })
      : (noteOwn(userData.lastUpdated), ref.set(userData, { merge: true }).then(function () { return userData; }));
    return write.then(function (merged) {
      var now = io.getUser();
      if (!now || now.uid !== user.uid) return;
      // The cloud held something this device didn't (e.g. cards added on another device): show it here
      if (merged && syncContentKey(merged) !== syncContentKey(userData)) {
        mergeIntoApp(merged);
        if (io.onCloudMerged) io.onCloudMerged();
      }
    }).catch(function (err) {
      console.warn("Cloud save failed (kept on this device):", err && err.message);
    });
  }

  return {
    rememberSyncState: rememberSyncState,
    buildUserDoc: buildUserDoc,
    syncContentKey: syncContentKey,
    writeLocalCache: writeLocalCache,
    mergeIntoApp: mergeIntoApp,
    saveUserData: saveUserData,
    setCloudReady: function (v) { cloudReady = !!v; },
    isCloudReady: function () { return cloudReady; },
    isOwnWrite: function (stamp) { return ownWrites.indexOf(stamp) !== -1; }
  };
}
