export default function DashboardSkeleton() {
  return (
    <div className="space-y-5 pb-16 animate-fade-in w-full">
      {/* Header Tabs Skeleton */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-20 h-7 rounded-lg bg-zinc-800/90 animate-pulse" />
          <div className="w-20 h-7 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
          <div className="w-24 h-7 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-7 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse hidden sm:block" />
          <div className="w-20 h-7 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
        </div>
      </div>

      {/* 4 Studio KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 md:p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between h-32"
          >
            <div className="flex items-center justify-between">
              <div className="w-24 h-3.5 rounded bg-zinc-800/80 animate-pulse" />
              <div className="w-12 h-4 rounded-full bg-zinc-800/60 animate-pulse" />
            </div>
            <div>
              <div className="w-32 h-7 rounded bg-zinc-800 animate-pulse mb-1.5" />
              <div className="w-28 h-3 rounded bg-zinc-800/50 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Visual Analytics Grid Skeleton (Line Chart + Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spending Overview Chart Skeleton */}
        <div className="lg:col-span-2 p-5 md:p-6 rounded-xl bg-[#121215] border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="w-36 h-4 rounded bg-zinc-800 animate-pulse" />
              <div className="w-24 h-3 rounded bg-zinc-800/50 animate-pulse" />
            </div>
            <div className="w-20 h-7 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
          </div>

          {/* Chart placeholder with vertical pulse bars */}
          <div className="h-60 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-end justify-between p-4 gap-2">
            {[40, 65, 30, 85, 55, 95, 45, 75, 60, 80, 50, 70].map((h, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-t bg-zinc-800/50 animate-pulse"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Account Allocation Donut Skeleton */}
        <div className="p-5 md:p-6 rounded-xl bg-[#121215] border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-36 h-4 rounded bg-zinc-800 animate-pulse" />
            <div className="w-24 h-7 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
          </div>

          <div className="flex items-center justify-center my-4">
            <div className="w-36 h-36 rounded-full border-8 border-zinc-800 border-t-zinc-700 animate-pulse flex items-center justify-center">
              <div className="w-16 h-4 rounded bg-zinc-800 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-800" />
                  <div className="w-20 h-3 rounded bg-zinc-800/70 animate-pulse" />
                </div>
                <div className="w-12 h-3 rounded bg-zinc-800/70 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Wallet / Accounts Skeleton */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#121215] border border-zinc-800 space-y-3">
          <div className="w-28 h-4 rounded bg-zinc-800 animate-pulse mb-3" />
          {[1, 2, 3].map((k) => (
            <div key={k} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 animate-pulse" />
                <div className="space-y-1">
                  <div className="w-28 h-3.5 rounded bg-zinc-800 animate-pulse" />
                  <div className="w-20 h-2.5 rounded bg-zinc-800/60 animate-pulse" />
                </div>
              </div>
              <div className="w-16 h-4 rounded bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="p-5 rounded-xl bg-[#121215] border border-zinc-800 space-y-4">
          <div className="w-28 h-4 rounded bg-zinc-800 animate-pulse" />
          <div className="h-10 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[1, 2, 3, 4].map((m) => (
              <div key={m} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
                <div className="w-10 h-2 rounded bg-zinc-800/60 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
