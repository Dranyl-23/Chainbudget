export default function TableSkeleton() {
  return (
    <div className="w-full animate-fade-in">
      <div className="glass rounded-xl overflow-hidden border border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.1)] w-full">
        {/* Table Header Skeleton */}
        <div className="bg-white/5 border-b border-purple-500/30 p-4 flex gap-4">
          <div className="w-1/4 h-5 rounded animate-shimmer-web3 opacity-60"></div>
          <div className="w-1/4 h-5 rounded animate-shimmer-web3 opacity-60 hidden md:block"></div>
          <div className="w-1/4 h-5 rounded animate-shimmer-web3 opacity-60 hidden lg:block"></div>
          <div className="w-1/4 h-5 rounded animate-shimmer-web3 opacity-60 ml-auto"></div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="divide-y divide-white/5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4 transition-colors">
              <div className="w-1/4">
                <div className="h-4 rounded w-3/4 animate-shimmer-web3 mb-2"></div>
                <div className="h-3 rounded w-1/2 animate-shimmer-web3 opacity-50"></div>
              </div>
              <div className="w-1/4 hidden md:block">
                <div className="h-5 rounded-full w-24 animate-shimmer-web3"></div>
              </div>
              <div className="w-1/4 hidden lg:block">
                <div className="h-4 rounded w-full animate-shimmer-web3"></div>
              </div>
              <div className="w-1/4 flex justify-end">
                <div className="h-6 rounded w-20 animate-shimmer-web3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
