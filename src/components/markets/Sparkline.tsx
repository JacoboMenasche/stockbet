"use client";

interface SparklineProps {
  data: { probability: number }[];
  height?: number;
  /** When true, draws YES (green) and NO (red) lines on a fixed 0–100 scale */
  dual?: boolean;
  /** Fallback YES price (1–99) used to synthesise a flat line when data has <2 points */
  fallbackPrice?: number;
}

export function Sparkline({ data, height = 24, dual = false, fallbackPrice }: SparklineProps) {
  const effectiveData =
    data && data.length >= 2
      ? data
      : fallbackPrice != null
      ? [{ probability: fallbackPrice }, { probability: fallbackPrice }]
      : null;

  if (!effectiveData) return null;

  const W = 200;
  const H = height;
  const pad = 2;

  const yesValues = effectiveData.map((d) => d.probability);
  // Detect storage format: 0–1 or 0–100
  const isNormalized = Math.max(...yesValues) <= 1;
  const scale = isNormalized ? 1 : 100;
  const noValues = yesValues.map((v) => scale - v);

  /** Map a value on a FIXED 0–scale axis to SVG y coordinate */
  function yFixed(v: number) {
    return H - pad - (v / scale) * (H - pad * 2);
  }

  /** Map a value on an AUTO-SCALED axis (for single-line mode) */
  function toPointsAuto(values: number[]) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((v, i) => ({
      x: pad + (i / (values.length - 1)) * (W - pad * 2),
      y: H - pad - ((v - min) / range) * (H - pad * 2),
    }));
  }

  function toPointsFixed(values: number[]) {
    return values.map((v, i) => ({
      x: pad + (i / (values.length - 1)) * (W - pad * 2),
      y: yFixed(v),
    }));
  }

  function pointsToStr(pts: { x: number; y: number }[]) {
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }

  function areaPath(pts: { x: number; y: number }[], fillDown = true) {
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const anchor = fillDown ? H : 0;
    return `${line} L${pts[pts.length - 1].x.toFixed(1)},${anchor} L${pts[0].x.toFixed(1)},${anchor} Z`;
  }

  if (dual) {
    // Fixed scale so YES and NO lines sit at their true probability positions
    const yesPoints = toPointsFixed(yesValues);
    const noPoints  = toPointsFixed(noValues);

    return (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="sp-yes-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94E484" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#94E484" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sp-no-fill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#D84838" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#D84838" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* YES area fills down from the YES line */}
        <path d={areaPath(yesPoints, true)}  fill="url(#sp-yes-fill)" />
        {/* NO area fills up from the NO line */}
        <path d={areaPath(noPoints, false)} fill="url(#sp-no-fill)" />
        {/* NO line (behind YES) */}
        <polyline
          points={pointsToStr(noPoints)}
          fill="none"
          stroke="#D84838"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
        {/* YES line (on top) */}
        <polyline
          points={pointsToStr(yesPoints)}
          fill="none"
          stroke="#94E484"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Single-line mode — auto-scale to emphasise movement
  const points = toPointsAuto(yesValues);
  const isUp = yesValues[yesValues.length - 1] >= yesValues[0];

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={pointsToStr(points)}
        fill="none"
        stroke={isUp ? "#94E484" : "#D84838"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
