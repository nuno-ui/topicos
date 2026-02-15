export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      {/* Header skeleton */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="skeleton h-8 w-64 mb-2" />
          <div className="skeleton h-5 w-40" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-[72px] w-[90px] rounded-xl" />
          ))}
        </div>
      </div>

      {/* Connected sources skeleton */}
      <div className="skeleton h-[88px] w-full rounded-xl mb-6" />

      {/* Quick actions skeleton */}
      <div className="flex gap-3 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-10 w-32 rounded-xl" />
        ))}
      </div>

      {/* AI Agents skeleton */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
