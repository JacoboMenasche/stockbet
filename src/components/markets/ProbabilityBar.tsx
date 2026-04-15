interface ProbabilityBarProps {
  yesPrice: number; // 1–99
  noPrice: number;
}

export function ProbabilityBar({ yesPrice, noPrice }: ProbabilityBarProps) {
  const total = yesPrice + noPrice || 100;
  const yesPct = (yesPrice / total) * 100;
  const noPct = (noPrice / total) * 100;

  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden flex">
      <div style={{ width: `${yesPct}%`, backgroundColor: "rgba(120, 190, 105, 0.8)" }} />
      <div style={{ width: `${noPct}%`, backgroundColor: "rgba(190, 70, 55, 0.8)" }} />
    </div>
  );
}
