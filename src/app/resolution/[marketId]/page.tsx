export default function ResolutionPage({
  params,
}: {
  params: { marketId: string };
}) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <p className="text-white/30 text-sm">Resolution — Slice 9 ({params.marketId})</p>
    </div>
  );
}
