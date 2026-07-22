// Tiny module-scoped store for the signed-in profile, set once by main.js
// after checking /api/auth/me, and read by any screen that needs to know
// "who am I" without re-fetching or prop-drilling through the router.
let profile = null;

export function setCurrentProfile(p) {
  profile = p;
}

export function currentProfile() {
  return profile;
}
