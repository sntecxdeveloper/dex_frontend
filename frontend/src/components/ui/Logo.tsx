interface LogoProps {
  /** Tile + wordmark, or just the mark */
  iconOnly?: boolean;
  /** Mark size (wordmark scales with md) */
  size?: 'sm' | 'md' | 'lg';
  /** Subtitle line under the wordmark */
  tagline?: string;
  className?: string;
}

const tileSize = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11' };
const iconSize = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

export function Logo({ iconOnly = false, size = 'md', tagline, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary-400 via-primary-600 to-primary-800 shadow-cta ${tileSize[size]}`}
      >
        {/* signal mark */}
        <svg
          className={`${iconSize[size]} text-white`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 17l4.5-4.5 3 3L17.5 8" />
          <circle cx="18.5" cy="6.5" r="1.8" fill="currentColor" stroke="none" />
        </svg>
        <span className="pointer-events-none absolute -inset-px rounded-[10px] ring-1 ring-inset ring-white/20" />
      </div>

      {!iconOnly && (
        <div className="min-w-0 leading-none">
          <p className="font-display text-[17px] font-bold tracking-[-0.02em] text-slate-900">
            DEX
          </p>
          {tagline ? (
            <p className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {tagline}
            </p>
          ) : (
            <p className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.18em] text-slate-500">
              IT Operations
            </p>
          )}
        </div>
      )}
    </div>
  );
}
