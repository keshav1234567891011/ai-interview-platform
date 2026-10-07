export function PerformanceChart({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`performance-chart ${compact ? "compact" : ""}`}>
      <svg
        viewBox="0 0 420 130"
        role="img"
        aria-label="Illustrative practice scores rise from 58 to 82 across six sample sessions"
      >
        <defs>
          <linearGradient
            id={compact ? "chart-fill-small" : "chart-fill-large"}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".2" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 60, 100].map((y) => (
          <line
            key={y}
            x1="4"
            x2="414"
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="3 5"
          />
        ))}
        <path
          d="M8 106 C45 106 54 71 86 76 S143 94 168 62 S224 63 250 41 S306 51 332 29 S383 36 412 12 L412 124 L8 124 Z"
          fill={`url(#${compact ? "chart-fill-small" : "chart-fill-large"})`}
        />
        <path
          d="M8 106 C45 106 54 71 86 76 S143 94 168 62 S224 63 250 41 S306 51 332 29 S383 36 412 12"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="412"
          cy="12"
          r="5"
          fill="var(--primary)"
          stroke="var(--card)"
          strokeWidth="3"
        />
      </svg>
      <div className="chart-labels">
        <span>Session 01</span>
        <span>Session 03</span>
        <span>Session 06</span>
      </div>
    </div>
  );
}
