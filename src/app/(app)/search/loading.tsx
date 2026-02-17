export default function SearchLoading() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-fade-in">
      <div className="mb-6">
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-5 w-72" />
      </div>
      {/* Search bar */}
      <div className="skeleton h-14 w-full rounded-2xl mb-4" />
      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton h-8 w-20 rounded-full" />
        ))}
      </div>
      {/* Results */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
