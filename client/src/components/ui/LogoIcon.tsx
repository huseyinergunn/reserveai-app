export function LogoIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Background */}
      <rect width="40" height="40" rx="10" fill="#2563eb" />
      {/* Calendar header darker band */}
      <rect width="40" height="13" rx="10" fill="#1d4ed8" />
      <rect y="7" width="40" height="6" fill="#1d4ed8" />
      {/* Calendar hooks */}
      <rect x="11" y="1" width="4" height="9" rx="2" fill="#93c5fd" />
      <rect x="25" y="1" width="4" height="9" rx="2" fill="#93c5fd" />
      {/* Bold R */}
      <path
        d="M11 18v14m0-14h9c3 0 5.5 2.2 5.5 5s-2.5 5-5.5 5H11m9 0 5.5 4"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* AI circuit node */}
      <circle cx="33" cy="19" r="3.5" fill="#60a5fa" />
      <circle cx="33" cy="19" r="1.8" fill="white" />
      {/* Connector */}
      <line x1="30.5" y1="21" x2="26.5" y2="23" stroke="#93c5fd" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
