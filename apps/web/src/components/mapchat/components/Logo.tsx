import React from "react";

export default function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      className={`${className} select-none`}
      fill="none"
    >
      {/* Outer Blue Circle Border */}
      <circle
        cx="250"
        cy="250"
        r="230"
        stroke="#3B82F6"
        strokeWidth="12"
        strokeDasharray="1100 300"
        strokeLinecap="round"
        className="opacity-95"
      />

      {/* Map Pin Icon at top-left position inside the circle */}
      <g transform="translate(110, 100) scale(1.4)">
        <path
          d="M24 0C10.75 0 0 10.75 0 24C0 42 24 64 24 64S48 42 48 24C48 10.75 37.25 0 24 0ZM24 34C18.48 34 14 29.52 14 24C14 18.48 18.48 14 24 14C29.52 14 34 18.48 34 24C34 29.52 29.52 34 24 34Z"
          fill="#3B82F6"
        />
        <circle cx="24" cy="24" r="7" fill="#FFFFFF" />
      </g>

      {/* Ground Mound / Earth silhouette */}
      <path
        d="M80 340 C 160 310, 340 310, 420 340 L 400 420 C 300 450, 200 450, 100 420 Z"
        fill="#1E3A8A"
      />

      {/* Curved White Path leading from bottom center to middle */}
      <path
        d="M260 410 C 230 380, 210 365, 230 350 C 255 330, 275 320, 260 300 C 250 290, 240 285, 230 280"
        stroke="#FFFFFF"
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
      />

      {/* Mother Silhouette walking right with custom navy outlines and blue backpack */}
      <g 
        stroke="#1E3A8A" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="#FFFFFF" 
        transform="translate(240, 115) scale(2.1)"
      >
        {/* Head */}
        <circle cx="34" cy="18" r="4.5" />
        {/* Backpack */}
        <path 
          d="M21 27 C 19 27, 18 31, 20 35 C 21 38, 25 38, 25 35 Z" 
          fill="#3B82F6" 
          stroke="#1E3A8A" 
          strokeWidth="1.5" 
        />
        {/* Body / Torso */}
        <path d="M25 24 C 28 23, 34 23, 37 25 C 38 27, 39 31, 37 36 L 31 52 C 30 54, 28 55, 26 53 L 24 40 L 25 24 Z" />
        {/* Hair blowing */}
        <path 
          d="M30 14 C 24 14, 20 18, 18 21 C 21 24, 26 23, 30 20 Z" 
          fill="#1E3A8A" 
          stroke="none" 
        />
        {/* Left Arm (holding hand of kid) */}
        <path d="M36 26 L 45 34 C 47 36, 48 38, 45 40 C 43 42, 41 40, 39 38 L 33 30 Z" />
        {/* Right Arm swinging forward */}
        <path d="M26 26 L 19 32 C 17 34, 18 36, 20 38 C 22 40, 24 38, 26 35 L 29 29 Z" />
        {/* Legs walking */}
        <path d="M26 52 L 20 67 C 19 69, 17 70, 15 69 L 10 68 C 8 67, 10 65, 12 65 L 18 64 L 24 52 Z" />
        <path d="M31 51 L 37 66 C 38 68, 41 69, 44 68 L 48 68 C 50 68, 50 66, 47 65 L 43 65 L 36 51 Z" />
      </g>

      {/* Girl Kid Silhouette (holding hands with parent) */}
      <g 
        stroke="#1E3A8A" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="#FFFFFF" 
        transform="translate(180, 195) scale(1.6)"
      >
        {/* Head */}
        <circle cx="34" cy="18" r="4" />
        {/* Ponytail */}
        <path 
          d="M31 16 C 26 14, 23 18, 22 21 C 25 22, 28 20, 30 18 Z" 
          fill="#1E3A8A" 
          stroke="none" 
        />
        {/* Body */}
        <path d="M28 24 C 30 23, 35 23, 37 25 C 38 27, 38 31, 37 36 L 32 48 L 27 48 L 27 34 Z" />
        {/* Arm holding mother's hand */}
        <path d="M34 26 L 43 32 C 45 33, 46 35, 44 36 C 42 37, 41 36, 39 34 L 32 29 Z" />
        {/* Legs walking */}
        <path d="M28 48 L 24 62 L 20 62 L 24 48 Z" />
        <path d="M32 48 L 36 62 L 40 62 L 35 48 Z" />
      </g>

      {/* Boy Kid Silhouette */}
      <g 
        stroke="#1E3A8A" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="#FFFFFF" 
        transform="translate(120, 190) scale(1.6)"
      >
        {/* Head */}
        <circle cx="34" cy="18" r="4" />
        {/* Body */}
        <path d="M28 24 C 30 23, 35 23, 37 25 C 38 27, 38 31, 37 36 L 32 48 L 27 48 L 27 34 Z" />
        {/* Arm holding girl's hand */}
        <path d="M34 26 L 43 32 C 45 33, 46 35, 44 36 C 42 37, 41 36, 39 34 L 32 29 Z" />
        {/* Legs walking */}
        <path d="M28 48 L 24 62 L 20 62 L 24 48 Z" />
        <path d="M32 48 L 36 62 L 40 62 L 35 48 Z" />
      </g>
    </svg>
  );
}
