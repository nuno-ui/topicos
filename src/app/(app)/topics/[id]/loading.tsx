export default function TopicDetailLoading() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-fade-in">
      {/* Back button + breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-4 w-4 rounded-full" />
        <div className="skeleton h-4 w-40" />
      </div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="skeleton h-8 w-64" />
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="skeleton h-4 w-96 mb-2" />
        <div className="flex items-center gap-4 mt-3">
          <div className="skeleton h-5 w-28" />
          <div className="skeleton h-5 w-28" />
          <div className="skeleton h-5 w-28" />
        </div>
      </div>
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-100 pb-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton h-9 w-24 rounded-lg" />
        ))}
      </div>
      {/* Content area */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
