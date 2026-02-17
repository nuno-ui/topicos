export default function ContactDetailLoading() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-fade-in">
      {/* Back button */}
      <div className="flex items-center gap-2 mb-6">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="skeleton h-4 w-24" />
      </div>
      {/* Header with avatar */}
      <div className="flex items-start gap-4 mb-8">
        <div className="skeleton w-16 h-16 rounded-2xl" />
        <div className="flex-1">
          <div className="skeleton h-7 w-48 mb-2" />
          <div className="skeleton h-4 w-64 mb-2" />
          <div className="flex items-center gap-3 mt-3">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-5 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-9 w-20 rounded-lg" />
          <div className="skeleton h-9 w-20 rounded-lg" />
        </div>
      </div>
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-100 pb-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-9 w-28 rounded-lg" />
        ))}
      </div>
      {/* Content */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
