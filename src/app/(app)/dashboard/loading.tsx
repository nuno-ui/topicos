export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 max-w-6xl animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-5 w-80" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
      {/* AI Agents section */}
      <div className="mb-6">
        <div className="skeleton h-6 w-32 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="skeleton h-6 w-36 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div>
          <div className="skeleton h-6 w-36 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
