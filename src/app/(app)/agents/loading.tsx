import { CardSkeleton, Skeleton, ListSkeleton } from '@/components/ui/loading-skeleton';

export default function AgentsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-6 w-48" />
      <ListSkeleton count={5} />
    </div>
  );
}
