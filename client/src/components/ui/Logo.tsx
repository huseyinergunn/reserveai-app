import { useId } from 'react';

interface LogoProps {
  className?: string;
}

export function Logo({ className = 'w-8 h-8' }: LogoProps) {
  // Her instance için benzersiz gradient ID — aynı sayfada çoklu kullanımda çakışma olmaz
  const uid = useId().replace(/:/g, '');
  const gradId = `logo-g-${uid}`;

  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ReserveAI"
      role="img"
    >
      <rect width="200" height="200" rx="40" fill={`url(#${gradId})`} />

      {/* "R" harfi ana gövde */}
      <path
        d="M60 50V150M60 50H110C132.091 50 150 67.9086 150 90C150 112.091 132.091 130 110 130H60M110 130L150 150"
        stroke="white"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Yatay çizgiler */}
      <path
        d="M85 75H125M85 95H125M85 115H105"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Sarı vurgu noktası — nefes alıyor */}
      <circle cx="155" cy="45" r="12" fill="#FACC15">
        <animate
          attributeName="opacity"
          values="1;0.4;1"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>

      <defs>
        <linearGradient
          id={gradId}
          x1="0"
          y1="0"
          x2="200"
          y2="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
