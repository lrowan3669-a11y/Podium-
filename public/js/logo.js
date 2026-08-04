// Podium mark: a spray-painted crown — "raise your game, own your future."
// Shown until a school uploads its own logo via #/school (see
// schoolBranding.js), at which point the upload replaces this everywhere.
export function crownMark(size = 40) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="32" cy="34" rx="29" ry="27" fill="#9B5CF6" opacity="0.10"/>
    <circle cx="6" cy="12" r="2" fill="#29D9CB" opacity="0.7"/>
    <circle cx="58" cy="10" r="1.6" fill="#FF6B4A" opacity="0.7"/>
    <circle cx="59" cy="46" r="2.2" fill="#C6EA3D" opacity="0.6"/>
    <circle cx="4" cy="46" r="1.5" fill="#29D9CB" opacity="0.6"/>

    <path
      d="M9 44 L16 19 L25 32 L32 12 L39 32 L48 19 L55 44 L55 55 Q55 57 53 57 L11 57 Q9 57 9 55 Z"
      fill="#9B5CF6"
      stroke="#5B21B6"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
    <circle cx="16" cy="19" r="3.2" fill="#C6EA3D"/>
    <circle cx="32" cy="12" r="3.6" fill="#FF6B4A"/>
    <circle cx="48" cy="19" r="3.2" fill="#29D9CB"/>
    <rect x="14" y="48" width="36" height="4" rx="1.5" fill="#7C3AED"/>

    <path d="M12 57 q1 5 2.5 2" stroke="#9B5CF6" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>
    <path d="M32 57 q1 6 2.5 2.5 q1 4 2 0.5" stroke="#9B5CF6" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.85"/>
    <path d="M50 57 q1 4 2.5 1.5" stroke="#9B5CF6" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>
  </svg>`;
}
