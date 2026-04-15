import DynamicIcon from './DynamicIcon'

interface ServiceBlockProps {
  block: any
  primary: string
  accent: string
  presentationMode: boolean
}

export default function ServiceBlock({ block, primary, accent, presentationMode }: ServiceBlockProps) {
  return (
    <div className={`relative overflow-hidden ${presentationMode ? 'p-6 sm:p-8' : 'p-5 sm:p-7'}`}>
      {/* Subtle gradient accent on left */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full" style={{ background: `linear-gradient(to bottom, ${primary}, ${accent})` }} />

      <div className="flex gap-5 pl-4">
        {/* Number badge */}
        {block.number_label && (
          <div className="flex-shrink-0 relative">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${primary}12, ${accent}12)` }}
            >
              <span
                className="text-2xl font-black bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
              >
                {block.number_label}
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            {block.icon && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${primary}18, ${accent}18)` }}
              >
                <DynamicIcon name={block.icon} className="w-3.5 h-3.5" style={{ color: primary }} />
              </div>
            )}
            <h3 className={`font-bold ${presentationMode ? 'text-lg text-white' : 'text-[15px] text-gray-800'}`}>
              {block.title}
            </h3>
          </div>
          {block.description && (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${presentationMode ? 'text-gray-300' : 'text-gray-500'}`}>
              {block.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
