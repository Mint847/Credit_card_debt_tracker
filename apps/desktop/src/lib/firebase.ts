// Firebase (the compat SDK, loaded by index.html like the phone app) with the same project.
// Both apps are served from the same site, so a sign-in in one is a sign-in in the other.
/* eslint-disable @typescript-eslint/no-explicit-any */

// The sign-in fix for iPhones (Safari and the home-screen app): sign-in runs on the app's own site, since
// Safari won't hand a sign-in finished on another domain back to this page, and the home-screen app signs in
// with a full-page redirect (a pop-up opens outside the app and can't report back). Turn on only once Google
// accepts https://stitch-debt-manager.web.app/__/auth/handler as a redirect address; until then Google
// blocks sign-in there. The phone app's working copy carries the same fix.
export const OWN_DOMAIN_SIGN_IN = false;

const firebaseConfig = {
  apiKey: 'AIzaSyAhSu_ei7ZKFJuVG-Na4_usyEnPUFfJIXY',
  // Local copies and previews use the default domain
  authDomain: OWN_DOMAIN_SIGN_IN && /^stitch-debt-manager\.(web\.app|firebaseapp\.com)$/.test(location.hostname) ? location.hostname : 'stitch-debt-manager.firebaseapp.com',
  projectId: 'stitch-debt-manager',
  storageBucket: 'stitch-debt-manager.firebasestorage.app',
  messagingSenderId: '511673500830',
  appId: '1:511673500830:web:2a38470c1a1e258798e78f'
};

// Demo mode (?demo): the sample account, no Firebase. Used for design previews and screenshots.
export const DEMO = (() => {
  try { return new URLSearchParams(location.search).has('demo') || sessionStorage.getItem('serendib_demo') === '1'; } catch (e) { return false; }
})();
if (DEMO) { try { sessionStorage.setItem('serendib_demo', '1'); } catch (e) { /* storage blocked */ } }

const fb: any = (window as any).firebase;
export const firebaseLoaded = !!fb;
if (fb && !DEMO && !fb.apps.length) fb.initializeApp(firebaseConfig);
export const firebase: any = fb;
export const auth: any = fb && !DEMO ? fb.auth() : null;
export const db: any = fb && !DEMO ? fb.firestore() : null;
