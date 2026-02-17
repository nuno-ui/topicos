export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-8 max-w-4xl animate-fade-in">
      <div className="mb-6">
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-5 w-64" />
      </div>
      {/* Connected accounts */}
      <div className="skeleton h-6 w-48 mb-3" />
      <div className="space-y-3 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
      {/* Settings sections */}
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
