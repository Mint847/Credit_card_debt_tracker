// Signing in to an account: instant start from this device's cache, then the cloud copy (merged, never
// overwritten), the live listener for other devices' edits, and retrying when the connection returns.
// Moved from the sign-in script in index.html (Phase 1). The UI plugs in through `io`:
//   db(), auth()                    Firestore and Firebase Auth
//   setCloudData(doc), setCloudReady(v), isCloudReady(), isOwnWrite(stamp), mergeRemote(doc), saveUserData()
//                                   the app's account store (the sync engine behind App in the phone app)
//   getLocalData()                  the account data the app currently holds (window.currentUserData)
//   takePendingName()               { firstName, lastName } typed at sign-up (or null), cleared once read
//   onRemoteMerged()                another device's change arrived: redraw
//   onBackOnline()                  a retry after being offline succeeded
import { saveSafetyCopy, mergeAccount } from './domain.js';

// This account's own copy on this device (plus a one-time move from the older email-keyed cache)
export function readAccountCache(uid, email) {
  var data = null;
  try {
    var raw = localStorage.getItem('stitch_user_uid_' + uid);
    if (raw) data = JSON.parse(raw);
  } catch (e) {}
  if (email) {
    try {
      var legacyKey = 'stitch_user_email_' + email;
      var legacyRaw = localStorage.getItem(legacyKey);
      if (!data && legacyRaw) {
        var legacy = JSON.parse(legacyRaw);
        if (legacy && legacy.uid === uid) data = legacy;
      }
      localStorage.removeItem(legacyKey);
    } catch (e) {}
  }
  return data;
}

export function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(function (_, reject) {
    setTimeout(function () { reject(new Error('timeout')); }, ms);
  })]);
}

export function createAccountSession(io) {
  var liveUnsub = null, liveUid = null;
  var retryTimer = null, retryUser = null, retryTrustLocal = false;

  // trustLocal: local edits newer than the cloud copy may replace it. False when this device had
  // no cached copy at sign-in, so an empty offline session can never overwrite real cloud data.
  async function syncAccountFromCloud(user, localData, trustLocal) {
    var doc = await withTimeout(io.db().collection('users').doc(user.uid).get(), 8000);
    var cloud = doc.exists ? (doc.data() || {}) : null;
    // Never pick one copy over the other: cards and spaces from both are kept (merged by id), and
    // only deliberate deletions remove anything. A safety copy of this device's data is kept first.
    if (localData) saveSafetyCopy(user.uid, localData, 'Before signing in');
    var data = mergeAccount(localData, cloud) || {};
    var pending = io.takePendingName();
    if (pending) {
      if (!data.firstName || (data.defaults && data.defaults.firstName)) data.firstName = pending.firstName;
      if (!data.lastName) data.lastName = pending.lastName;
      if (data.defaults) { delete data.defaults.firstName; if (!Object.keys(data.defaults).length) delete data.defaults; }
    }
    data.email = (user.email || '').toLowerCase().trim();
    data.uid = user.uid;
    io.setCloudData(data);
    io.setCloudReady(true);
    // Creates the document for new accounts and pushes newer edits made on this device
    await io.saveUserData();
    startLiveSync(user);
  }

  /* Live sync: edits made on another device arrive while this one is open. Anything that isn't
     this device's own write is merged in (never a straight replace); device clocks are never compared. */
  function stopLiveSync() {
    if (liveUnsub) { try { liveUnsub(); } catch (e) {} }
    liveUnsub = null;
    liveUid = null;
  }
  function startLiveSync(user) {
    if (liveUid === user.uid && liveUnsub) return;
    stopLiveSync();
    var ref = io.db().collection('users').doc(user.uid);
    if (typeof ref.onSnapshot !== 'function') return;
    liveUid = user.uid;
    liveUnsub = ref.onSnapshot(function (snap) {
      if (!snap.exists || (snap.metadata && snap.metadata.hasPendingWrites)) return;
      var current = io.auth().currentUser;
      if (!current || current.uid !== user.uid || !io.isCloudReady()) return;
      var remote = snap.data() || {};
      if (io.isOwnWrite(remote.lastUpdated)) return;
      var local = io.getLocalData() || {};
      if (remote.lastUpdated === local.lastUpdated) return;
      io.mergeRemote(remote);
      if (io.onRemoteMerged) io.onRemoteMerged();
    }, function (err) {
      console.warn('Live sync stopped:', err && err.message);
      liveUnsub = null;
      liveUid = null;
    });
  }

  function stopCloudRetry() {
    clearTimeout(retryTimer);
    retryTimer = null;
    window.removeEventListener('online', retryCloudSync);
  }
  function scheduleCloudRetry(user, trustLocal) {
    retryUser = user;
    retryTrustLocal = trustLocal;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(retryCloudSync, 30000);
    window.removeEventListener('online', retryCloudSync);
    window.addEventListener('online', retryCloudSync);
  }
  async function retryCloudSync() {
    var user = retryUser, current = io.auth().currentUser;
    if (!user || !current || current.uid !== user.uid || io.isCloudReady()) { stopCloudRetry(); return; }
    var local = readAccountCache(user.uid, null); // includes edits made while offline
    try {
      await syncAccountFromCloud(user, local, retryTrustLocal);
      stopCloudRetry();
      if (io.onBackOnline) io.onBackOnline();
    } catch (e) {
      scheduleCloudRetry(user, retryTrustLocal);
    }
  }

  return {
    syncAccountFromCloud: syncAccountFromCloud,
    startLiveSync: startLiveSync,
    stopLiveSync: stopLiveSync,
    scheduleCloudRetry: scheduleCloudRetry,
    stopCloudRetry: stopCloudRetry,
    retryCloudSync: retryCloudSync
  };
}
