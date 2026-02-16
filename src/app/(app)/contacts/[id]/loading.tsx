export default function ContactDetailLoading() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-page-enter">
      {/* Back button skeleton */}
      <div className="mb-6">
        <div className="h-8 w-24 skeleton rounded-lg" />
      </div>

      {/* Header section */}
      <div className="flex items-start gap-5 mb-8">
        {/* Avatar skeleton */}
        <div className="w-16 h-16 rounded-2xl skeleton flex-shrink-0" />
        <div className="flex-1 space-y-3">
          {/* Name */}
          <div className="h-7 w-48 skeleton rounded-lg" />
          {/* Badges row */}
          <div className="flex gap-2">
            <div className="h-5 w-16 skeleton rounded-full" />
            <div className="h-5 w-20 skeleton rounded-full" />
            <div className="h-5 w-24 skeleton rounded-full" />
          </div>
          {/* Email / org */}
          <div className="h-4 w-64 skeleton rounded" />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-4 rounded-xl border border-gray-100">
            <div className="h-8 w-12 skeleton rounded mb-2 mx-auto" />
            <div className="h-3 w-20 skeleton rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {/* Section 1 */}
        <div className="rounded-xl border border-gray-100 p-5">
          <div className="h-5 w-32 skeleton rounded mb-4" />
          <div className="space-y-3">
            <div className="h-12 skeleton rounded-lg" />
            <div className="h-12 skeleton rounded-lg" />
            <div className="h-12 skeleton rounded-lg" />
          </div>
        </div>

        {/* Section 2 */}
        <div className="rounded-xl border border-gray-100 p-5">
          <div className="h-5 w-40 skeleton rounded mb-4" />
          <div className="space-y-3">
            <div className="h-16 skeleton rounded-lg" />
            <div className="h-16 skeleton rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
