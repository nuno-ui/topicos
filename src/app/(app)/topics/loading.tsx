export default function TopicsLoading() {
  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      <div className="mb-6">
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-5 w-80" />
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton h-10 flex-1 rounded-lg" />
        <div className="skeleton h-10 w-28 rounded-lg" />
        <div className="skeleton h-10 w-24 rounded-lg" />
        <div className="skeleton h-10 w-24 rounded-lg" />
      </div>
      <div className="space-y-3 mt-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton h-[88px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
