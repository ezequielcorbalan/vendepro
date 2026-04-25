export interface PdfDownloadTokenPayload {
  r2Key: string
  orgId: string
  appraisalId: string
}

export interface PdfDownloadTokenSigner {
  /** Signs a JWT and builds the full download URL. */
  buildDownloadUrl(input: { r2Key: string; orgId: string; appraisalId: string; filename: string; ttlSec: number }): Promise<string>
  /** Verifies a token; returns payload on success, null on expiry/invalid. */
  verify(token: string): Promise<PdfDownloadTokenPayload | null>
}
