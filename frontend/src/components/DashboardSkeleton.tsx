export default function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-8 pb-20 animate-fade-in w-full">
      {/* Header Skeleton */}
      <div className="mb-8 flex flex-wrap justify-between items-center gap-4">
        <div className="space-y-3 w-1/3 min-w-[200px]">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse w-full"></div>
        </div>
        <div className="flex gap-3">
          <div className="w-32 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          <div className="w-40 h-10 bg-primary/20 rounded-lg animate-pulse"></div>
        </div>
      </div>

      {/* Stats Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass p-6 rounded-xl border border-gray-100 dark:border-gray-800 h-32 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"></div>
              <div className="w-12 h-5 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
            </div>
            <div>
              <div className="w-24 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2"></div>
              <div className="w-32 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Skeleton */}
        <div className="lg:col-span-2 glass p-6 rounded-xl h-[400px] flex flex-col">
          <div className="w-40 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-8"></div>
          <div className="flex-1 w-full bg-gray-100 dark:bg-gray-800/50 rounded-lg animate-pulse"></div>
        </div>

        {/* Side Panel Skeletons */}
        <div className="space-y-8">
          {/* Transparency Score */}
          <div className="glass p-6 rounded-xl h-48 flex flex-col justify-between">
            <div className="w-40 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
            <div className="flex justify-center my-4">
              <div className="w-20 h-20 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
          </div>

          {/* Recent Transactions List */}
          <div className="glass p-6 rounded-xl flex-1 flex flex-col">
            <div className="w-40 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
                    <div>
                      <div className="w-24 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2"></div>
                      <div className="w-16 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="w-16 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
