export default function TableSkeleton() {
  return (
    <div className="w-full animate-fade-in">
      <div className="glass rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
        {/* Table Header Skeleton */}
        <div className="bg-gray-50 dark:bg-[#1A1B25] border-b border-gray-100 dark:border-gray-800 p-4 flex gap-4">
          <div className="w-1/4 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          <div className="w-1/4 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse hidden md:block"></div>
          <div className="w-1/4 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse hidden lg:block"></div>
          <div className="w-1/4 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse ml-auto"></div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
              <div className="w-1/4">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800/50 rounded w-1/2 animate-pulse"></div>
              </div>
              <div className="w-1/4 hidden md:block">
                <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded-full w-24 animate-pulse"></div>
              </div>
              <div className="w-1/4 hidden lg:block">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full animate-pulse"></div>
              </div>
              <div className="w-1/4 flex justify-end">
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-20 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
