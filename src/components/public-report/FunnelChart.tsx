'use client'

import type { FunnelData } from '@/lib/types'

export default function FunnelChart({ data }: { data: FunnelData[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const totalHeight = data.length * 64
  const svgWidth = 500
  const centerX = svgWidth / 2
  const maxBarWidth = 440
  const minBarWidth = 100
  const stepHeight = 56
  const gap = 8

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${svgWidth} ${totalHeight}`}
        className="w-full max-w-lg"
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((item, index) => {
          // Each level gets progressively narrower to form funnel shape
          const ratio = data.length > 1 ? 1 - (index / (data.length - 1)) * 0.7 : 1
          const barWidth = minBarWidth + (maxBarWidth - minBarWidth) * ratio
          const nextRatio = data.length > 1 ? 1 - ((index + 1) / (data.length - 1)) * 0.7 : 1
          const nextBarWidth = index < data.length - 1
            ? minBarWidth + (maxBarWidth - minBarWidth) * nextRatio
            : barWidth * 0.85

          const y = index * (stepHeight + gap)
          const topLeft = centerX - barWidth / 2
          const topRight = centerX + barWidth / 2
          const bottomLeft = centerX - nextBarWidth / 2
          const bottomRight = centerX + nextBarWidth / 2

          const points = `${topLeft},${y} ${topRight},${y} ${bottomRight},${y + stepHeight} ${bottomLeft},${y + stepHeight}`

          return (
            <g key={item.label}>
              {/* Trapezoid shape */}
              <polygon
                points={points}
                fill={item.color}
                opacity={0.9}
                rx={4}
              />
              {/* Label */}
              <text
                x={centerX}
                y={y + stepHeight / 2 - 6}
                textAnchor="middle"
                fill="white"
                fontSize="13"
                fontWeight="600"
                fontFamily="Poppins, sans-serif"
              >
                {item.label}
              </text>
              {/* Value */}
              <text
                x={centerX}
                y={y + stepHeight / 2 + 12}
                textAnchor="middle"
                fill="white"
                fontSize="18"
                fontWeight="700"
                fontFamily="Poppins, sans-serif"
              >
                {item.value.toLocaleString('es-AR')}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
