export default function MarketDetailPage({
  params,
}: {
  params: { marketId: string };
}) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <p className="text-white/30 text-sm">Market detail — Slice 3 ({params.marketId})</p>
    </div>
  );
}
