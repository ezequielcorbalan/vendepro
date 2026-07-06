import type { HydratedBlock, AppraisalContext, RenderMode } from './types'
import { blockDataAttrs } from './block-utils'
import { UnknownBlock } from './blocks/UnknownBlock'
import { CoverBlock } from './blocks/CoverBlock'
import { PropertyDataBlock } from './blocks/PropertyDataBlock'
import { SwotBlock } from './blocks/SwotBlock'
import { WorkConditionsBlock } from './blocks/WorkConditionsBlock'
import { ComparablesListBlock } from './blocks/ComparablesListBlock'
import { ProposalCommercialBlock } from './blocks/ProposalCommercialBlock'
import { ServicesGridBlock } from './blocks/ServicesGridBlock'
import { MarketStatsBlock } from './blocks/MarketStatsBlock'
import { FunnelChartBlock } from './blocks/FunnelChartBlock'
import { MethodologyBlock } from './blocks/MethodologyBlock'
import { NotaryChartsBlock } from './blocks/NotaryChartsBlock'
import { ZoneMapBlock } from './blocks/ZoneMapBlock'
import { PriceProjectionBlock } from './blocks/PriceProjectionBlock'
import { VideoGalleryBlock } from './blocks/VideoGalleryBlock'
import { ExtraMediaBlock } from './blocks/ExtraMediaBlock'
import { CtaWhatsappBlock } from './blocks/CtaWhatsappBlock'
import { AgentContactCardBlock } from './blocks/AgentContactCardBlock'
import { HeadingBlock } from './blocks/HeadingBlock'
import { RichTextBlock } from './blocks/RichTextBlock'
import { ImageBlock } from './blocks/ImageBlock'
import { DividerBlock } from './blocks/DividerBlock'
import { CalloutBlock } from './blocks/CalloutBlock'
import { ButtonLinkBlock } from './blocks/ButtonLinkBlock'

interface Props {
  block: HydratedBlock
  mode: RenderMode
  appraisal: AppraisalContext
}

export function BlockRenderer({ block, mode, appraisal }: Props) {
  const attrs = blockDataAttrs(block)
  const data = block.resolved_data
  switch (block.type) {
    case 'cover':
      return <CoverBlock data={data as any} appraisal={appraisal} {...attrs} />
    case 'property_data':
      return <PropertyDataBlock data={data as any} {...attrs} />
    case 'swot':
      return <SwotBlock data={data as any} {...attrs} />
    case 'work_conditions':
      return <WorkConditionsBlock data={data as any} {...attrs} />
    case 'comparables_list':
      return <ComparablesListBlock data={data as any} {...attrs} />
    case 'proposal_commercial':
      return <ProposalCommercialBlock data={data as any} {...attrs} />
    case 'services_grid':
      return <ServicesGridBlock data={data as any} {...attrs} />
    case 'market_stats':
      return <MarketStatsBlock data={data as any} {...attrs} />
    case 'funnel_chart':
      return <FunnelChartBlock data={data as any} {...attrs} />
    case 'methodology':
      return <MethodologyBlock data={data as any} {...attrs} />
    case 'notary_charts':
      return <NotaryChartsBlock data={data as any} {...attrs} />
    case 'zone_map':
      return <ZoneMapBlock data={data as any} {...attrs} />
    case 'price_projection':
      return <PriceProjectionBlock data={data as any} {...attrs} />
    case 'video_gallery':
      return <VideoGalleryBlock data={data as any} {...attrs} />
    case 'extra_media':
      return <ExtraMediaBlock data={data as any} {...attrs} />
    case 'cta_whatsapp':
      return <CtaWhatsappBlock data={data as any} {...attrs} />
    case 'agent_contact_card':
      return <AgentContactCardBlock data={data as any} appraisal={appraisal} {...attrs} />
    case 'heading':
      return <HeadingBlock data={data as any} {...attrs} />
    case 'rich_text':
      return <RichTextBlock data={data as any} {...attrs} />
    case 'image':
      return <ImageBlock data={data as any} {...attrs} />
    case 'divider':
      return <DividerBlock data={data as any} {...attrs} />
    case 'callout':
      return <CalloutBlock data={data as any} {...attrs} />
    case 'button_link':
      return <ButtonLinkBlock data={data as any} {...attrs} />
    default:
      return <UnknownBlock type={block.type} {...attrs} />
  }
}
