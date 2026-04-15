import type { TemplateBlock } from '../../../domain/entities/template-block'

export interface TemplateBlockRepository {
  findByOrg(orgId: string): Promise<TemplateBlock[]>
  findById(id: string, orgId: string): Promise<TemplateBlock | null>
  save(block: TemplateBlock): Promise<void>
  updateOrder(blocks: Array<{ id: string; sort_order: number }>, orgId: string): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
