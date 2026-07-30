import AppLogo from '@/components/ui/AppLogo';

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-lg bg-muted ${className}`} />
);

export default function Loading() {
  return (
    <main className="ft-shell min-h-screen" aria-busy="true" aria-label="Loading FabricTrad">
      <div className="ft-topbar sticky top-0 z-40 h-16">
        <div className="mx-auto flex h-full max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <AppLogo size={32} />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto hidden h-10 w-72 md:block" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
      <div className="ft-page space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-52 sm:w-72" />
            <Skeleton className="h-4 w-64 max-w-[70vw] sm:w-96" />
          </div>
          <Skeleton className="hidden h-10 w-32 sm:block" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="ft-card space-y-3 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
          ))}
        </div>
        <div className="ft-card p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="aspect-[4/3] w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
