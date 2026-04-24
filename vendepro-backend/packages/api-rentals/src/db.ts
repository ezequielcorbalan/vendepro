import { createId } from './utils'

export type Env = {
  DB: D1Database
  R2: R2Bucket
  JWT_SECRET: string
}

export type AuthVars = {
  Variables: {
    userId: string
    userEmail: string
    userRole: string
    orgId: string
  }
}

export { createId }
