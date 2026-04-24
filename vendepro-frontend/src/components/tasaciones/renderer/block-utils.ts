import { WEB_ONLY_TYPES, PAGE_BREAK_BEFORE, type AppraisalBlockType } from './types'

export function blockDataAttrs(block: { id: string; type: AppraisalBlockType; include_in_pdf: boolean }) {
  return {
    'data-block': block.type,
    'data-block-id': block.id,
    'data-block-web-only': (!block.include_in_pdf || WEB_ONLY_TYPES.has(block.type)) ? 'true' : undefined,
    'data-block-page-break': PAGE_BREAK_BEFORE.has(block.type) ? 'true' : undefined,
  }
}
