export interface CreateTokenOptions {
  /**
   * Expiración del token.
   * - `undefined` (default): usa el TTL por defecto del servicio (sesiones de usuario).
   * - `null`: token sin expiración (tokens de integración, revocables vía DB).
   * - string/number: valor explícito (ej. `'365d'` o segundos).
   */
  expiresIn?: string | number | null
}

export interface AuthService {
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, hash: string): Promise<boolean>
  createToken(payload: Record<string, unknown>, options?: CreateTokenOptions): Promise<string>
  verifyToken(token: string): Promise<Record<string, unknown> | null>
}
