// Sign-in rules shared by both apps: friendly error messages, password rules and the sign-up
// form checks. Moved from the sign-in script in index.html (Phase 3). Firebase calls stay in each UI.

export function authErrorMessage(err, providerName) {
  var name = providerName || "This";
  switch ((err && err.code) || "") {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/missing-password": return "Enter your password.";
    case "auth/email-already-in-use": return "This email already has an account. Log in instead.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Choose a stronger password that meets the requirements below.";
    case "auth/too-many-requests": return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed": return "Can't reach the server. Check your connection and try again.";
    case "auth/user-disabled": return "This account has been disabled.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
    case "auth/invalid-oauth-provider":
      return name + " sign-in isn't available yet. Use Google or email instead.";
    case "auth/account-exists-with-different-credential":
      return "This email already has an account. Log in with the method you used before.";
    case "auth/unauthorized-domain": return "Sign-in isn't allowed from this web address.";
    case "auth/popup-blocked": return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    default: return "Something went wrong. Please try again.";
  }
}

// A closed or replaced pop-up isn't an error worth showing
export function isQuietAuthError(err) {
  var code = err && err.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}
// Pop-ups that can't open fall back to a full-page redirect
export function shouldRedirectAfter(err) {
  var code = err && err.code;
  return code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment";
}

export function checkPasswordRules(password, confirm) {
  password = password || "";
  confirm = confirm || "";
  var len = password.length >= 8;
  var upper = /[A-Z]/.test(password);
  var lower = /[a-z]/.test(password);
  var num = /[0-9]/.test(password);
  var special = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);
  var match = password.length > 0 && password === confirm;
  var isValid = len && upper && lower && num && special && match;
  return { len: len, upper: upper, lower: lower, num: num, special: special, match: match, isValid: isValid };
}

// "Your password needs at least 8 characters, a symbol."
export function passwordNeedsText(rules) {
  var missing = [];
  if (!rules.len) missing.push("at least 8 characters");
  if (!rules.upper) missing.push("an uppercase letter");
  if (!rules.lower) missing.push("a lowercase letter");
  if (!rules.num) missing.push("a number");
  if (!rules.special) missing.push("a symbol");
  return "Your password needs " + missing.join(", ") + ".";
}

// The sign-up form's checks, in the order the phone app runs them. Returns null when it can be
// submitted, otherwise { field, message } (field: which input to highlight, or null).
export function signupFormError(f) {
  if (!f.firstName || !f.lastName || !f.email) return { field: null, message: "Enter your first name, last name and email address." };
  if (!f.password) return { field: 'password', message: "Create a password to continue." };
  if (!f.confirm) return { field: 'confirm', message: "Confirm your password." };
  if (f.password !== f.confirm) return { field: 'confirm', message: "Passwords don't match." };
  var rules = checkPasswordRules(f.password, f.confirm);
  if (!rules.isValid) return { field: 'password', message: passwordNeedsText(rules), rules: true };
  return null;
}

// How an account signs in: 'password' when email sign-in is linked, otherwise its first provider
export var PROVIDER_LABELS = { 'password': 'Email & password', 'google.com': 'Google', 'apple.com': 'Apple', 'twitter.com': 'X' };
export function primaryProvider(u) {
  var ids = ((u && u.providerData) || []).map(function (pd) { return pd.providerId; });
  if (ids.indexOf('password') !== -1) return 'password';
  return ids[0] || 'password';
}
// Only email-and-password accounts are asked to verify their address
export function needsEmailVerification(u) {
  return !!(u && !u.emailVerified && primaryProvider(u) === 'password');
}
// Delete account: what to say when confirming identity or deleting fails
export function deleteAccountError(err, provider) {
  var code = err && err.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Confirm with ' + (PROVIDER_LABELS[provider] || 'your sign-in method') + ' to delete your account.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') return 'Incorrect password.';
  return authErrorMessage(err);
}
