export default async function ResolutionPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <p className="text-white/30 text-sm">Resolution — Slice 9 ({marketId})</p>
    </div>
  );
}
