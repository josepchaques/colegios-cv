export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 258 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="MejorColegio"
    >
      {/* Bar chart */}
      <rect x="4"  y="36" width="7" height="8"  rx="2" fill="#F5A623"/>
      <rect x="14" y="28" width="7" height="16" rx="2" fill="#E8635A"/>
      <rect x="24" y="19" width="7" height="25" rx="2" fill="#4A7FC1"/>

      {/* Magnifying glass — circle */}
      <circle cx="50" cy="21" r="18" fill="white" stroke="#1D3461" strokeWidth="4.5"/>
      {/* Handle */}
      <line x1="63" y1="34" x2="74" y2="46" stroke="#1D3461" strokeWidth="5.5" strokeLinecap="round"/>

      {/* School inside glass */}
      {/* Wings */}
      <rect x="38" y="24" width="24" height="12" rx="1" fill="#2DBFA8"/>
      {/* Central tower body */}
      <rect x="44" y="18" width="12" height="18" rx="1" fill="#2DBFA8"/>
      {/* Roof */}
      <polygon points="43,18 50,9 57,18" fill="#2DBFA8"/>
      {/* Door */}
      <path d="M47 36 L47 29 Q47 26.5 50 26.5 Q53 26.5 53 29 L53 36 Z" fill="white"/>
      {/* Round window */}
      <circle cx="50" cy="22" r="2.5" fill="white"/>
      {/* Flag pole */}
      <line x1="50" y1="9" x2="50" y2="4" stroke="#1D3461" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Flag */}
      <polygon points="50,4 56,6 50,9" fill="#1D3461"/>

      {/* Logotype */}
      <text
        x="84"
        y="31"
        fontFamily="'Open Sans', 'Inter', system-ui, sans-serif"
        fontWeight="700"
        fontSize="24"
        fill="#1D3461"
      >
        mejor<tspan fill="#2DBFA8">colegio</tspan>
      </text>

      {/* Tagline */}
      <text
        x="84"
        y="43"
        fontFamily="'Open Sans', 'Inter', system-ui, sans-serif"
        fontSize="8.5"
        fill="#1D3461"
        opacity="0.55"
      >
        Encuentra el mejor colegio para tu familia
      </text>
    </svg>
  );
}
