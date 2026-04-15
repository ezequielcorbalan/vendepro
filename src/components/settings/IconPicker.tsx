'use client'

import {
  Camera, Video, Globe, Layout, Sofa, BarChart3, FileBarChart,
  TrendingUp, FileText, RotateCcw, Image, Target, Users, Phone,
  Mail, Star, Shield, Zap, Award, Heart, Home, MapPin, Clock,
  CheckCircle, Eye, Search, Megaphone, Briefcase
} from 'lucide-react'

export const ICON_MAP: Record<string, any> = {
  Camera, Video, Globe, Layout, Sofa, BarChart3, FileBarChart,
  TrendingUp, FileText, RotateCcw, Image, Target, Users, Phone,
  Mail, Star, Shield, Zap, Award, Heart, Home, MapPin, Clock,
  CheckCircle, Eye, Search, Megaphone, Briefcase
}

export const ICON_NAMES = Object.keys(ICON_MAP)

interface IconPickerProps {
  value: string | null
  onChange: (icon: string) => void
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-7 gap-1.5 p-2 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
      {ICON_NAMES.map(name => {
        const Icon = ICON_MAP[name]
        const selected = value === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
              selected
                ? 'bg-brand-pink text-white'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title={name}
          >
            <Icon className="w-4 h-4" />
          </button>
        )
      })}
    </div>
  )
}
