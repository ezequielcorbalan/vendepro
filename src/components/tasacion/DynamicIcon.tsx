import {
  Camera, Video, Globe, Layout, Sofa, BarChart3, FileBarChart,
  TrendingUp, FileText, RotateCcw, Image, Target, Users, Phone,
  Mail, Star, Shield, Zap, Award, Heart, Home, MapPin, Clock,
  CheckCircle, Eye, Search, Megaphone, Briefcase
} from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  Camera, Video, Globe, Layout, Sofa, BarChart3, FileBarChart,
  TrendingUp, FileText, RotateCcw, Image, Target, Users, Phone,
  Mail, Star, Shield, Zap, Award, Heart, Home, MapPin, Clock,
  CheckCircle, Eye, Search, Megaphone, Briefcase
}

export default function DynamicIcon({ name, ...props }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name]
  return Icon ? <Icon {...props} /> : null
}
