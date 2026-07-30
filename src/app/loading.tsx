import AppLogo from '@/components/ui/AppLogo';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background" aria-busy="true" aria-label="Loading FabricTrad">
      <div className="sticky top-0 z-40 h-16 border-b border-border commerce-glass">
        <div className="mx-auto flex h-full max-w-[1480px] items-center gap-3 px-4 sm:px-6">
          <AppLogo size={32} />
          <div className="commerce-skeleton h-4 w-24" />
          <div className="ml-auto hidden h-10 w-72 commerce-skeleton md:block" />
          <div className="h-10 w-10 rounded-full commerce-skeleton" />
        </div>
      </div>
      <div className="commerce-page space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="commerce-skeleton h-8 w-52 sm:w-72" />
            <div className="commerce-skeleton h-4 w-64 max-w-[70vw] sm:w-96" />
          </div>
          <div className="hidden h-10 w-32 commerce-skeleton sm:block" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="commerce-surface space-y-3 p-4">
              <div className="commerce-skeleton h-4 w-20" />
              <div className="commerce-skeleton h-8 w-28" />
              <div className="commerce-skeleton h-3 w-32 max-w-full" />
            </div>
          ))}
        </div>
        <div className="commerce-surface p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="commerce-skeleton h-5 w-40" />
            <div className="commerce-skeleton h-9 w-24" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <div className="commerce-skeleton aspect-[4/3] w-full" />
                <div className="commerce-skeleton h-4 w-4/5" />
                <div className="commerce-skeleton h-3 w-3/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
