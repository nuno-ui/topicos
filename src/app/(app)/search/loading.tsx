export default function SearchLoading() {
  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      <div className="mb-8">
        <div className="skeleton h-8 w-28 mb-2" />
        <div className="skeleton h-5 w-96" />
      </div>
      <div className="skeleton h-12 w-full rounded-xl mb-6" />
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-9 w-28 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
