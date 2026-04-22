import type { LandingRepository } from '../../ports/repositories/landing-repository'

/**
 * Lista las landings de la organización que están marcadas como plantilla
 * de tasación (`template_type='tasacion'`). El frontend usa esta lista para
 * que el agente elija una plantilla al crear una nueva tasación a partir de
 * una landing.
 */
export class ListTasacionTemplatesUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { orgId: string }) {
    return this.landings.findTemplatesByType(input.orgId, 'tasacion')
  }
}
