interface ProbabilityBarProps {
  yesPrice: number; // 1–99
  noPrice: number;
}

export function ProbabilityBar({ yesPrice, noPrice }: ProbabilityBarProps) {
  const total = yesPrice + noPrice || 100;
  const yesPct = (yesPrice / total) * 100;
  const noPct = (noPrice / total) * 100;

  return (
    <div className="flex flex-col gap-1 w-full">
      {/* YES bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${yesPct}%`,
            backgroundColor: "rgba(120, 190, 105, 0.75)",
          }}
        />
      </div>
      {/* NO bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${noPct}%`,
            backgroundColor: "rgba(190, 70, 55, 0.75)",
          }}
        />
      </div>
    </div>
  );
}
