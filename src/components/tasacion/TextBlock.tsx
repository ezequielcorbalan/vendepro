import { CheckCircle } from 'lucide-react'
import DynamicIcon from './DynamicIcon'

interface TextBlockProps {
  block: any
  primary: string
  accent: string
  presentationMode: boolean
}

export default function TextBlock({ block, primary, accent, presentationMode }: TextBlockProps) {
  // Split description into lines for visual list rendering
  const lines = (block.description || '').split('\n').filter((l: string) => l.trim())
  const hasMultipleItems = lines.length > 2

  return (
    <div className="p-5 sm:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${primary}15, ${accent}15)` }}
        >
          {block.icon ? (
            <DynamicIcon name={block.icon} className="w-5 h-5" style={{ color: primary }} />
          ) : (
            <CheckCircle className="w-5 h-5" style={{ color: primary }} />
          )}
        </div>
        <h2 className={`text-lg sm:text-xl font-bold ${presentationMode ? 'text-white' : 'text-gray-800'}`}>
          {block.title}
        </h2>
      </div>

      {hasMultipleItems ? (
        <div className="space-y-3">
          {lines.map((line: string, i: number) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl p-3.5 ${
                presentationMode ? 'bg-white/5' : 'bg-white border border-gray-100'
              }`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `linear-gradient(135deg, ${primary}15, ${accent}15)` }}
              >
                <CheckCircle className="w-3.5 h-3.5" style={{ color: primary }} />
              </div>
              <p className={`text-sm leading-relaxed ${presentationMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {line}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${presentationMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {block.description}
        </p>
      )}
    </div>
  )
}
