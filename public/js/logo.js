// Podium mark: 1-2-3 podium blocks + star.
// Placeholder built in SVG until the real logo assets (podium-mark-transparent.png,
// podium-logo-full.png, podium-icon.png) are dropped into public/img/.
export function podiumMark(size = 40) {
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="4" y="34" width="16" height="22" rx="2" fill="#1BAF7A"/>
    <rect x="24" y="20" width="16" height="36" rx="2" fill="#EDC44B"/>
    <rect x="44" y="40" width="16" height="16" rx="2" fill="#E24B4A"/>
    <text x="12" y="50" font-family="Arial Black, Arial" font-weight="900" font-size="11" fill="#0a0a0d" text-anchor="middle">2</text>
    <text x="32" y="42" font-family="Arial Black, Arial" font-weight="900" font-size="13" fill="#0a0a0d" text-anchor="middle">1</text>
    <text x="52" y="54" font-family="Arial Black, Arial" font-weight="900" font-size="10" fill="#0a0a0d" text-anchor="middle">3</text>
    <path d="M32 2 L35 9 L42.5 10 L37 15 L38.5 22.5 L32 18.5 L25.5 22.5 L27 15 L21.5 10 L29 9 Z" fill="#EDC44B"/>
  </svg>`;
}
