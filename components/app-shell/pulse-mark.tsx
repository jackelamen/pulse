export function PulseMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pm-bolt" x1="24" y1="8" x2="40" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e879f9"/>
          <stop offset="0.5" stopColor="#c084fc"/>
          <stop offset="1" stopColor="#a855f7"/>
        </linearGradient>
        <linearGradient id="pm-ecg" x1="4" y1="32" x2="60" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0abfc" stopOpacity="0"/>
          <stop offset="0.15" stopColor="#f0abfc"/>
          <stop offset="0.85" stopColor="#c084fc"/>
          <stop stopColor="#c084fc" stopOpacity="0"/>
        </linearGradient>
        <filter id="pm-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Lightning bolt */}
      <path
        d="M37 8 L22 34 L30 34 L27 56 L42 30 L34 30 Z"
        fill="url(#pm-bolt)"
        filter="url(#pm-glow)"
      />

      {/* ECG pulse line */}
      <path
        d="M4 32 L16 32 L20 24 L24 40 L28 32 L33 32 L37 24 L41 40 L45 32 L60 32"
        stroke="url(#pm-ecg)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#pm-glow)"
      />
    </svg>
  );
}
