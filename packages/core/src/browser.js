// Browser entry for the phone/iPad app: every core export becomes a global under the same
// name it had when it lived in index.html, so the app's code keeps working unchanged.
import * as core from './index.js';

Object.keys(core).forEach(function (name) { window[name] = core[name]; });

export default core;
