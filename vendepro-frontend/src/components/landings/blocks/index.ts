import HeroBlock from './HeroBlock'
import HeroSplitBlock from './HeroSplitBlock'
import FeaturesGridBlock from './FeaturesGridBlock'
import AmenitiesChipsBlock from './AmenitiesChipsBlock'
import GalleryBlock from './GalleryBlock'
import BenefitsListBlock from './BenefitsListBlock'
import LeadFormBlock from './LeadFormBlock'
import FooterBlock from './FooterBlock'
import AgentHeroBlock from './AgentHeroBlock'
import AgentCredentialsBlock from './AgentCredentialsBlock'
import FaqBlock from './FaqBlock'
import CtaWhatsappBlock from './CtaWhatsappBlock'
import type { BlockType } from '@/lib/landings/types'
import type { ComponentType } from 'react'

export const BLOCK_COMPONENTS: Record<BlockType, ComponentType<any>> = {
  'hero': HeroBlock,
  'hero-split': HeroSplitBlock,
  'features-grid': FeaturesGridBlock,
  'amenities-chips': AmenitiesChipsBlock,
  'gallery': GalleryBlock,
  'benefits-list': BenefitsListBlock,
  'lead-form': LeadFormBlock,
  'footer': FooterBlock,
  'agent-hero': AgentHeroBlock,
  'agent-credentials': AgentCredentialsBlock,
  'faq': FaqBlock,
  'cta-whatsapp': CtaWhatsappBlock,
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  'hero': 'Hero',
  'hero-split': 'Hero dividido',
  'features-grid': 'Grid de features',
  'amenities-chips': 'Amenities',
  'gallery': 'Galería',
  'benefits-list': 'Beneficios',
  'lead-form': 'Formulario',
  'footer': 'Footer',
  'agent-hero': 'Hero de agente',
  'agent-credentials': 'Credenciales',
  'faq': 'Preguntas frecuentes',
  'cta-whatsapp': 'CTA WhatsApp',
}

export {
  HeroBlock, HeroSplitBlock, FeaturesGridBlock, AmenitiesChipsBlock, GalleryBlock, BenefitsListBlock, LeadFormBlock, FooterBlock,
  AgentHeroBlock, AgentCredentialsBlock, FaqBlock, CtaWhatsappBlock,
}
