// Podium mark: 1-2-3 podium blocks + star.
// Placeholder built in SVG until the real logo assets (podium-mark-transparent.png,
// podium-logo-full.png, podium-icon.png) are dropped into public/img/.
export function podiumMark(size = 40) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="32" cy="34" rx="30" ry="27" fill="#EDC44B" opacity="0.08"/>
    <circle cx="8" cy="10" r="2.4" fill="#E24B4A" opacity="0.7"/>
    <circle cx="58" cy="16" r="1.6" fill="#1BAF7A" opacity="0.7"/>
    <circle cx="60" cy="50" r="2" fill="#4A3AA7" opacity="0.6"/>
    <rect x="4" y="34" width="16" height="22" rx="2" fill="#1BAF7A"/>
    <path d="M6 56 q1 5 2.5 2 q1 4 2 0.5" stroke="#1BAF7A" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>
    <rect x="24" y="20" width="16" height="36" rx="2" fill="#EDC44B"/>
    <path d="M27 56 q1 6 2.5 2.5 q1 5 2 1" stroke="#EDC44B" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.85"/>
    <rect x="44" y="40" width="16" height="16" rx="2" fill="#E24B4A"/>
    <path d="M47 56 q1 4 2.5 1.5" stroke="#E24B4A" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>
    <text x="12" y="50" font-family="Arial Black, Arial" font-weight="900" font-size="11" fill="#0a0a0d" text-anchor="middle">2</text>
    <text x="32" y="42" font-family="Arial Black, Arial" font-weight="900" font-size="13" fill="#0a0a0d" text-anchor="middle">1</text>
    <text x="52" y="54" font-family="Arial Black, Arial" font-weight="900" font-size="10" fill="#0a0a0d" text-anchor="middle">3</text>
    <path d="M32 1 L35.5 8.5 L43.5 9.5 L37.5 14.8 L39 22.8 L32 18.5 L25 22.8 L26.5 14.8 L20.5 9.5 L28.5 8.5 Z" fill="#EDC44B" transform="rotate(-6 32 12)"/>
  </svg>`;
}
