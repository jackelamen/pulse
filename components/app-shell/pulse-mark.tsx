export function PulseMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pm-bolt" x1="24" y1="8" x2="40" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e879f9"/>
          <stop offset=".5" stopColor="#c026d3"/>
          <stop offset="1" stopColor="#7c3aed"/>
        </linearGradient>
        <linearGradient id="pm-sheen" x1="24" y1="8" x2="34" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity=".55"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
        <filter id="pm-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Lightning bolt */}
      <path
        d="M36.5 8.5 L21.5 34.5 L30 34.5 L27.5 55.5 L42.5 29.5 L34 29.5 Z"
        fill="url(#pm-bolt)"
        filter="url(#pm-glow)"
      />
      <path
        d="M36.5 8.5 L21.5 34.5 L30 34.5 L27.5 55.5 L42.5 29.5 L34 29.5 Z"
        fill="url(#pm-sheen)"
      />

      {/* ECG line — white, same as original Pulse mark */}
      <path
        d="M4 33 L14 33 L18 24 L23 42 L27.5 33 L34 33 L38 24 L43 42 L47 33 L60 33"
        stroke="white"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
