export default function Loading() {
  return (
    <div className="animate-fade-in p-6 space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-4 w-72 rounded-md" />
        </div>
        <div className="skeleton h-10 w-32 rounded-xl" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-20 rounded-md" />
              <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
            <div className="skeleton h-7 w-16 rounded-md" />
            <div className="skeleton h-3 w-28 rounded-md" />
          </div>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded-md" />
                  <div className="skeleton h-3 w-1/2 rounded-md" />
                </div>
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="skeleton h-3 w-full rounded-md" />
                <div className="skeleton h-3 w-5/6 rounded-md" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="skeleton h-5 w-14 rounded-full" />
                <div className="skeleton h-5 w-14 rounded-full" />
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar area */}
        <div className="space-y-4">
          {/* Activity panel skeleton */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="skeleton h-5 w-24 rounded-md" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-full rounded-md" />
                  <div className="skeleton h-2.5 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions skeleton */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="skeleton h-5 w-28 rounded-md" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
