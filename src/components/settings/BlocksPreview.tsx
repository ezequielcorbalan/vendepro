'use client'

import { X } from 'lucide-react'
import { ICON_MAP } from './IconPicker'

function youtubeEmbed(url: string) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  if (url.includes('youtube.com/embed/')) return url.replace('youtube.com', 'youtube-nocookie.com')
  if (url.includes('youtube-nocookie.com')) return url
  return url
}

interface BlocksPreviewProps {
  blocks: any[]
  branding: { primary: string; accent: string; logo_url: string | null; name: string }
  settings: Record<string, string>
  onClose: () => void
}

export default function BlocksPreview({ blocks, branding, settings, onClose }: BlocksPreviewProps) {
  const { primary, accent } = branding
  const enabledBlocks = blocks.filter(b => b.enabled)
  const commercialBlocks = enabledBlocks.filter(b => b.section === 'commercial')
  const conditionBlocks = enabledBlocks.filter(b => b.section === 'conditions')

  const gradientStyle = { background: `linear-gradient(to right, ${primary}, ${accent})` }
  const gradientVStyle = { background: `linear-gradient(to bottom, ${primary}, ${accent})` }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto">
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] bg-white text-gray-700 p-2.5 rounded-full shadow-lg hover:bg-gray-100"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Preview label */}
      <div className="fixed top-4 left-4 z-[60] bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium">
        Preview — así se ve la landing
      </div>

      <div className="min-h-screen bg-white max-w-5xl mx-auto my-8 rounded-2xl shadow-2xl overflow-hidden">
        {/* Hero */}
        <header className="relative overflow-hidden bg-white border-b border-gray-100">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 sm:w-2" style={gradientVStyle} />
          <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
            <div className="flex items-center gap-3 mb-6">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.name} className="h-8 sm:h-12" />
              ) : (
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
              )}
              <span className="text-gray-400 font-medium text-sm">Operaciones Inmobiliarias</span>
            </div>
            <div className="inline-block rounded-full px-4 py-1.5 mb-4" style={gradientStyle}>
              <p className="text-white text-xs sm:text-sm font-medium tracking-wider uppercase">Propuesta de tasación</p>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-3 text-gray-800">Dirección de ejemplo</h1>
            <p className="text-lg sm:text-xl text-gray-400 font-light">Barrio, Buenos Aires</p>
          </div>
        </header>

        <div className="px-4 sm:px-8 py-10 space-y-8">
          {/* Commercial blocks */}
          {commercialBlocks.map((block: any) => (
            <div key={block.id} className="bg-[#f8f8f8] rounded-2xl border border-gray-100 overflow-hidden">
              {block.block_type === 'video' && block.video_url ? (
                <>
                  <div className="aspect-video">
                    <iframe src={youtubeEmbed(block.video_url)!} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                  {block.description && (
                    <div className="p-5 sm:p-8">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <span className="w-1 h-7 rounded-full" style={gradientVStyle} />
                        {block.title}
                      </h2>
                      <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{block.description}</p>
                    </div>
                  )}
                </>
              ) : block.block_type === 'video' && !block.video_url ? (
                <div className="p-8 text-center">
                  <div className="aspect-video max-w-md mx-auto bg-gray-200 rounded-xl flex items-center justify-center mb-4">
                    <p className="text-gray-400 text-sm">Sin URL de video configurada</p>
                  </div>
                  <p className="text-gray-500 font-medium">{block.title}</p>
                </div>
              ) : block.block_type === 'service' ? (
                <div className="relative overflow-hidden p-5 sm:p-7">
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full" style={gradientVStyle} />
                  <div className="flex gap-5 pl-4">
                    {block.number_label && (
                      <div className="flex-shrink-0">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primary}12, ${accent}12)` }}>
                          <span className="text-2xl font-black bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                            {block.number_label}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        {block.icon && (() => {
                          const Icon = ICON_MAP[block.icon]
                          return Icon ? (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${primary}18, ${accent}18)` }}>
                              <Icon className="w-3.5 h-3.5" style={{ color: primary }} />
                            </div>
                          ) : null
                        })()}
                        <h3 className="font-bold text-[15px] text-gray-800">{block.title}</h3>
                      </div>
                      {block.description && (
                        <p className="text-sm leading-relaxed text-gray-500 whitespace-pre-wrap">{block.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : block.block_type === 'stats' ? (
                <div className="p-5 sm:p-8">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-1 h-7 rounded-full" style={gradientVStyle} />
                    {block.title}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {settings.tasacion_datos_props_publicadas && (
                      <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-6 text-center">
                        <p className="font-bold text-gray-800 text-3xl">{Number(settings.tasacion_datos_props_publicadas).toLocaleString('es-AR')}</p>
                        <p className="text-sm mt-1 text-gray-500">Propiedades en venta</p>
                      </div>
                    )}
                    {settings.tasacion_datos_vendidas_mes && settings.tasacion_datos_props_publicadas && (
                      <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-2xl p-6 text-center">
                        <p className="font-bold text-gray-800 text-3xl">
                          {(Number(settings.tasacion_datos_vendidas_mes) / Number(settings.tasacion_datos_props_publicadas) * 100).toFixed(1)}%
                        </p>
                        <p className="text-sm mt-1 text-gray-500">Se vende por mes</p>
                      </div>
                    )}
                    {settings.tasacion_datos_escrituras_mes && (
                      <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-2xl p-6 text-center">
                        <p className="font-bold text-gray-800 text-3xl">{Number(settings.tasacion_datos_escrituras_mes).toLocaleString('es-AR')}</p>
                        <p className="text-sm mt-1 text-gray-500">Escrituras por mes</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (() => {
                const lines = (block.description || '').split('\n').filter((l: string) => l.trim())
                const hasMultipleItems = lines.length > 2
                return (
                  <div className="p-5 sm:p-8">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${primary}15, ${accent}15)` }}>
                        {block.icon && (() => {
                          const Icon = ICON_MAP[block.icon]
                          return Icon ? <Icon className="w-5 h-5" style={{ color: primary }} /> : null
                        })()}
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800">{block.title}</h2>
                    </div>
                    {hasMultipleItems ? (
                      <div className="space-y-3">
                        {lines.map((line: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 rounded-xl p-3.5 bg-white border border-gray-100">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `linear-gradient(135deg, ${primary}15, ${accent}15)` }}>
                              <svg className="w-3.5 h-3.5" style={{ color: primary }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-600">{line}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{block.description}</p>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}

          {/* Divider */}
          <div className="relative py-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px opacity-20" style={{ background: `linear-gradient(to right, transparent, ${primary}, transparent)` }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-8 py-2 text-xs font-semibold uppercase tracking-[0.2em] bg-white shadow-sm border border-pink-100 rounded-full" style={{ color: primary }}>
                Tasación de tu propiedad
              </span>
            </div>
          </div>

          {/* Placeholder for per-appraisal data */}
          <div className="bg-[#f8f8f8] rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">Acá van los datos de la tasación (FODA, comparables, valuación, etc.)</p>
            <p className="text-gray-300 text-xs mt-1">Estos datos son por tasación, no editables desde el template</p>
          </div>

          {/* Condition blocks */}
          {conditionBlocks.map((block: any) => {
            const lines = (block.description || '').split('\n').filter((l: string) => l.trim())
            const hasMultipleItems = lines.length > 2
            return (
              <div key={block.id} className="bg-[#f8f8f8] rounded-2xl border border-gray-100 p-5 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${primary}15, ${accent}15)` }}>
                    {block.icon && (() => {
                      const Icon = ICON_MAP[block.icon]
                      return Icon ? <Icon className="w-5 h-5" style={{ color: primary }} /> : null
                    })()}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">{block.title}</h2>
                </div>
                {hasMultipleItems ? (
                  <div className="space-y-3">
                    {lines.map((line: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl p-3.5 bg-white border border-gray-100">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `linear-gradient(135deg, ${primary}15, ${accent}15)` }}>
                          <svg className="w-3.5 h-3.5" style={{ color: primary }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-600">{line}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{block.description}</p>
                )}
              </div>
            )
          })}

          {/* CTA */}
          <div className="relative bg-[#f8f8f8] rounded-2xl p-8 sm:p-16 text-center border border-gray-100">
            <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={gradientStyle} />
            <p className="text-gray-400 text-xs font-medium tracking-widest uppercase mb-3">Siguiente paso</p>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-800 mb-4">¿Listo para vender al mejor precio?</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <span className="inline-flex items-center gap-2 text-white px-8 py-3.5 rounded-full font-semibold text-sm" style={gradientStyle}>
                Agendar reunión
              </span>
              <span className="inline-flex items-center gap-2 bg-green-500 text-white px-8 py-3.5 rounded-full font-semibold text-sm">
                WhatsApp
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-100 py-10 text-center">
          {branding.logo_url && <img src={branding.logo_url} alt={branding.name} className="h-10 mx-auto mb-4" />}
          <p className="text-gray-600 text-sm font-medium">{branding.name} · Operaciones Inmobiliarias</p>
        </footer>
      </div>
    </div>
  )
}
