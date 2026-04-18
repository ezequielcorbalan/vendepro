import HeroBlock from './HeroBlock'
import HeroSplitBlock from './HeroSplitBlock'
import FeaturesGridBlock from './FeaturesGridBlock'
import AmenitiesChipsBlock from './AmenitiesChipsBlock'
import GalleryBlock from './GalleryBlock'
import BenefitsListBlock from './BenefitsListBlock'
import LeadFormBlock from './LeadFormBlock'
import FooterBlock from './FooterBlock'
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
}

export { HeroBlock, HeroSplitBlock, FeaturesGridBlock, AmenitiesChipsBlock, GalleryBlock, BenefitsListBlock, LeadFormBlock, FooterBlock }
