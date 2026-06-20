interface Props {
  total: number
  current: number
}

export default function StepIndicator({ total, current }: Props) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <div
            key={step}
            className={`rounded-full transition-all duration-300 ${
              isActive
                ? 'w-6 h-2 bg-gradient-to-r from-brand-pink to-brand-orange'
                : isDone
                ? 'w-2 h-2 bg-brand-pink'
                : 'w-2 h-2 bg-gray-200'
            }`}
          />
        )
      })}
      <span className="text-xs text-gray-400 ml-1">{current}/{total}</span>
    </div>
  )
}
