// Firebase (the compat SDK, loaded by index.html like the phone app) with the same project.
// Both apps are served from the same site, so a sign-in in one is a sign-in in the other.
/* eslint-disable @typescript-eslint/no-explicit-any */
const firebaseConfig = {
  apiKey: 'AIzaSyAhSu_ei7ZKFJuVG-Na4_usyEnPUFfJIXY',
  authDomain: 'stitch-debt-manager.firebaseapp.com',
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
