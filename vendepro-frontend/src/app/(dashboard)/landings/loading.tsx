export default function Loading() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-40 mb-6"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  )
}
