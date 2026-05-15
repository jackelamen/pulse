export function PulseMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="25" fill="url(#pulse-mark-bg)" />
      <path
        d="M18 34h8.5l4.2-12 7.1 23 4.5-11H50"
        stroke="white"
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 7a25 25 0 0 1 25 25"
        stroke="white"
        strokeOpacity="0.36"
        strokeWidth="4.8"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="pulse-mark-bg" x1="13" y1="12" x2="52" y2="53" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8a5f" />
          <stop offset="0.55" stopColor="#f25c2a" />
          <stop offset="1" stopColor="#cc3b18" />
        </linearGradient>
      </defs>
    </svg>
  );
}
