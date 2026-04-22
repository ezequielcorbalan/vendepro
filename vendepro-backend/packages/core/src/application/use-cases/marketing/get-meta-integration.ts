import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'

export interface GetMetaIntegrationOutput {
  org_id: string
  pixel_id: string | null
  stape_endpoint: string | null
  gtm_container_id: string | null
  test_event_code: string | null
  enabled: boolean
  has_access_token: boolean
  /** Mascarilla cliente: nunca enviamos el token plain */
  access_token: string
  created_at?: string
  updated_at?: string
}

export class GetMetaIntegrationUseCase {
  constructor(private readonly repo: MetaIntegrationRepository) {}

  async execute(orgId: string): Promise<GetMetaIntegrationOutput> {
    const integration = await this.repo.findByOrg(orgId)
    if (!integration) {
      return {
        org_id: orgId,
        pixel_id: null,
        stape_endpoint: null,
        gtm_container_id: null,
        test_event_code: null,
        enabled: false,
        has_access_token: false,
        access_token: '',
      }
    }
    const pub = integration.toPublicView()
    return {
      org_id: pub.org_id,
      pixel_id: pub.pixel_id,
      stape_endpoint: pub.stape_endpoint,
      gtm_container_id: pub.gtm_container_id,
      test_event_code: pub.test_event_code,
      enabled: pub.enabled,
      has_access_token: pub.has_access_token,
      access_token: pub.has_access_token ? '********' : '',
      created_at: pub.created_at,
      updated_at: pub.updated_at,
    }
  }
}
