export interface UnsubscribeTokenPayload {
  orgId: string
  email: string
}

/**
 * Firma/verifica tokens de baja de emails de marketing.
 * Los tokens NO expiran: un link de unsubscribe debe funcionar siempre
 * (requisito CAN-SPAM / buenas prácticas de deliverability).
 */
export interface UnsubscribeTokenSigner {
  sign(payload: UnsubscribeTokenPayload): Promise<string>
  verify(token: string): Promise<UnsubscribeTokenPayload | null>
}
