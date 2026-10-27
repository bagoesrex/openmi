import React from "react";

interface BrandIconProps {
  className?: string;
  size?: number;
}

export const BrandIcon: React.FC<BrandIconProps> = ({ className = "w-6 h-6", size }) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-label="OpenMi Logo"
    >
      <defs>
        <linearGradient id="openmi-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6900" />
          <stop offset="1" stopColor="#E04F00" />
        </linearGradient>
      </defs>
      {/* Xiaomi-inspired squircle container */}
      <rect width="32" height="32" rx="8.5" fill="url(#openmi-grad)" />
      
      {/* Precision Unlocked Shackle */}
      <path
        d="M10.5 14V9.5C10.5 6.46 12.96 4 16 4C19.04 4 21.5 6.46 21.5 9.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Lock Body */}
      <rect x="7" y="13.5" width="18" height="13.5" rx="3.5" fill="white" />

      {/* Modern Keyhole & Speed Accent */}
      <circle cx="16" cy="19" r="1.5" fill="#EA580C" />
      <path d="M16 20.5V23" stroke="#EA580C" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};

export default BrandIcon;
