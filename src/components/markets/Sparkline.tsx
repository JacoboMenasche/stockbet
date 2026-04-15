"use client";

interface SparklineProps {
  data: { probability: number }[];
  height?: number;
  /** When true, draws both the YES (green) and NO (red) lines with area fills */
  dual?: boolean;
}

export function Sparkline({ data, height = 24, dual = false }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const W = 200; // internal viewBox width
  const H = height;
  const pad = 2;

  const yesValues = data.map((d) => d.probability);
  const noValues = yesValues.map((v) => {
    // probability may be stored as 0–1 or 0–100; detect by max value
    const isNormalized = Math.max(...yesValues) <= 1;
    return isNormalized ? 1 - v : 100 - v;
  });

  function toPoints(values: number[]) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (W - pad * 2);
      const y = H - pad - ((v - min) / range) * (H - pad * 2);
      return { x, y };
    });
  }

  function pointsToStr(pts: { x: number; y: number }[]) {
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }

  function areaPath(pts: { x: number; y: number }[]) {
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L${last.x.toFixed(1)},${H} L${first.x.toFixed(1)},${H} Z`;
  }

  if (dual) {
    const yesPoints = toPoints(yesValues);
    const noPoints = toPoints(noValues);
    const yesStr = pointsToStr(yesPoints);
    const noStr = pointsToStr(noPoints);
    const yesArea = areaPath(yesPoints);
    const noArea = areaPath(noPoints);

    return (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="yes-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94E484" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#94E484" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="no-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D84838" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#D84838" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fills */}
        <path d={yesArea} fill="url(#yes-fill)" />
        <path d={noArea} fill="url(#no-fill)" />
        {/* Lines */}
        <polyline
          points={noStr}
          fill="none"
          stroke="#D84838"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <polyline
          points={yesStr}
          fill="none"
          stroke="#94E484"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Single-line mode (original behaviour)
  const points = toPoints(yesValues);
  const pointsStr = pointsToStr(points);
  const isUp = yesValues[yesValues.length - 1] >= yesValues[0];
  const color = isUp ? "#94E484" : "#D84838";

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
