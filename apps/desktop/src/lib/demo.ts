// The public demo (?demo): sample data, no account, nothing stored. Where its feedback link goes, and how
// a visitor leaves the demo for the real app.
import { DEMO } from './firebase';

export { DEMO };

// The public demo link, as posted
export const DEMO_URL = 'https://stitch-debt-manager.web.app/desktop/?demo';

// Leave the demo: forget it for this tab and open the real sign-in page
export function exitDemo() {
  try { sessionStorage.removeItem('serendib_demo'); } catch (e) { /* storage blocked */ }
  location.assign('/desktop/');
}
