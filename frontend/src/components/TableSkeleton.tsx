export default function TableSkeleton() {
  return (
    <div className="w-full animate-fade-in">
      <div className="bg-[#121215] rounded-xl overflow-hidden border border-zinc-800 shadow-xs w-full">
        {/* Table Header Skeleton */}
        <div className="bg-[#0e0e11] border-b border-zinc-800 px-4 py-3.5 flex items-center gap-4">
          <div className="w-32 h-3.5 rounded bg-zinc-800/80 animate-pulse" />
          <div className="w-24 h-3.5 rounded bg-zinc-800/60 animate-pulse hidden md:block" />
          <div className="w-28 h-3.5 rounded bg-zinc-800/60 animate-pulse hidden lg:block" />
          <div className="w-20 h-3.5 rounded bg-zinc-800/80 animate-pulse ml-auto" />
        </div>

        {/* Table Rows Skeleton */}
        <div className="divide-y divide-zinc-800/60">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              {/* Lead Icon / Avatar + Description */}
              <div className="flex items-center gap-3 w-1/3 min-w-44">
                <div className="w-8 h-8 rounded-lg bg-zinc-800/90 animate-pulse shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div 
                    className="h-3.5 rounded bg-zinc-800/80 animate-pulse" 
                    style={{ width: `${65 + (i * 7) % 25}%` }} 
                  />
                  <div 
                    className="h-2.5 rounded bg-zinc-800/50 animate-pulse" 
                    style={{ width: `${40 + (i * 9) % 20}%` }} 
                  />
                </div>
              </div>

              {/* Status Pill Placeholder */}
              <div className="w-1/4 hidden md:flex items-center">
                <div className="h-5 rounded-full w-20 bg-zinc-800/70 animate-pulse" />
              </div>

              {/* Category / Metadata Placeholder */}
              <div className="w-1/4 hidden lg:flex items-center">
                <div 
                  className="h-3.5 rounded bg-zinc-800/50 animate-pulse" 
                  style={{ width: `${50 + (i * 11) % 30}%` }} 
                />
              </div>

              {/* Amount / Action Placeholder */}
              <div className="w-1/4 flex justify-end items-center ml-auto">
                <div className="h-4 rounded bg-zinc-800/80 w-20 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
