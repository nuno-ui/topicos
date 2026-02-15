export default function SettingsLoading() {
  return (
    <div className="p-8 max-w-3xl animate-fade-in">
      <div className="mb-8">
        <div className="skeleton h-8 w-28 mb-2" />
        <div className="skeleton h-5 w-80" />
      </div>
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
