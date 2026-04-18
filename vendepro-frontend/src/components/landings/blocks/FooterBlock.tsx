import { Phone, Mail, MessageCircle, Instagram } from 'lucide-react'
import type { FooterData } from '@/lib/landings/types'

export default function FooterBlock({ data }: { data: FooterData; mode?: 'public' | 'editor' }) {
  return (
    <footer className="bg-white border-t border-gray-200 py-10 px-6 text-center text-sm text-gray-600">
      <div className="max-w-4xl mx-auto space-y-3">
        {data.agency_name && <p className="font-semibold text-gray-900">{data.agency_name}</p>}
        {data.agency_registration && <p className="text-xs text-gray-500">{data.agency_registration}</p>}
        <div className="flex flex-wrap gap-4 justify-center text-gray-700">
          {data.phone && <a href={`tel:${data.phone}`} className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><Phone className="w-4 h-4" />{data.phone}</a>}
          {data.email && <a href={`mailto:${data.email}`} className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><Mail className="w-4 h-4" />{data.email}</a>}
          {data.whatsapp && <a href={`https://wa.me/${data.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><MessageCircle className="w-4 h-4" />{data.whatsapp}</a>}
          {data.instagram && <a href={`https://instagram.com/${data.instagram.replace('@', '')}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><Instagram className="w-4 h-4" />{data.instagram}</a>}
        </div>
        {data.disclaimer && <p className="text-xs text-gray-400 pt-4 border-t border-gray-100 max-w-2xl mx-auto">{data.disclaimer}</p>}
      </div>
    </footer>
  )
}
