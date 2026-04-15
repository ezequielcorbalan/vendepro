export interface AuthService {
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, hash: string): Promise<boolean>
  createToken(payload: Record<string, unknown>): Promise<string>
  verifyToken(token: string): Promise<Record<string, unknown> | null>
}
