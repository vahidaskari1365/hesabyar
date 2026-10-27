import { cn } from "@/lib/utils";

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hyg" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#0f9d78" />
          <stop offset="100%" stopColor="#c8963e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#hyg)" />
      <path
        d="M14 13h20a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V15a2 2 0 0 1 2-2Z"
        fill="white"
        fillOpacity="0.92"
      />
      <rect x="16" y="17" width="16" height="5" rx="1.5" fill="#0f9d78" />
      <rect x="16" y="25" width="4.5" height="2.6" rx="1" fill="#3a3a3a" />
      <rect x="21.75" y="25" width="4.5" height="2.6" rx="1" fill="#3a3a3a" />
      <rect x="27.5" y="25" width="4.5" height="2.6" rx="1" fill="#3a3a3a" />
      <rect x="16" y="29.4" width="4.5" height="2.6" rx="1" fill="#3a3a3a" />
      <rect x="21.75" y="29.4" width="4.5" height="2.6" rx="1" fill="#c8963e" />
      <rect x="27.5" y="29.4" width="4.5" height="2.6" rx="1" fill="#3a3a3a" />
    </svg>
  );
}
