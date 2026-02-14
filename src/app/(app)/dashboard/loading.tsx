import { StatsSkeleton, ListSkeleton, CardSkeleton } from '@/components/ui/loading-skeleton';
import { Skeleton } from '@/components/ui/loading-skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Stats */}
      <StatsSkeleton />

      {/* Content */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ListSkeleton count={5} />
        </div>
        <div>
          <ListSkeleton count={3} />
        </div>
      </div>
    </div>
  );
}
