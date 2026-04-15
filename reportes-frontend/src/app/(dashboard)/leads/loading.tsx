export default function Loading() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="flex gap-2">
        <div className="h-10 flex-1 bg-gray-200 rounded-lg" />
        <div className="h-10 w-28 bg-gray-200 rounded-lg" />
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-20 bg-gray-200 rounded-xl" />
      ))}
    </div>
  )
}
