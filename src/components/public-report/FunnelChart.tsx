'use client'

import { useRef, useState, useEffect } from 'react'
import type { FunnelData } from '@/lib/types'

export default function FunnelChart({ data }: { data: FunnelData[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(400)

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const svgWidth = width
  const centerX = svgWidth / 2
  const maxBarWidth = svgWidth * 0.88
  const minBarWidth = svgWidth * 0.25
  const stepHeight = Math.max(44, Math.min(56, width * 0.12))
  const gap = 6
  const totalHeight = data.length * (stepHeight + gap)

  const labelSize = Math.max(10, Math.min(13, width * 0.032))
  const valueSize = Math.max(13, Math.min(18, width * 0.042))

  return (
    <div ref={containerRef} className="w-full">
      <svg
        viewBox={`0 0 ${svgWidth} ${totalHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((item, index) => {
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
              <polygon
                points={points}
                fill={item.color}
                opacity={0.9}
              />
              <text
                x={centerX}
                y={y + stepHeight / 2 - 5}
                textAnchor="middle"
                fill="white"
                fontSize={labelSize}
                fontWeight="600"
                fontFamily="Poppins, sans-serif"
              >
                {item.label}
              </text>
              <text
                x={centerX}
                y={y + stepHeight / 2 + 11}
                textAnchor="middle"
                fill="white"
                fontSize={valueSize}
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
