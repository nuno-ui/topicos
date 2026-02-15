export default function ContactsLoading() {
  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      <div className="mb-8">
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-5 w-72" />
      </div>
      <div className="skeleton h-10 w-full rounded-lg mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
