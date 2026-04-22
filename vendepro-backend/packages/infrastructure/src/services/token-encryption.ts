/**
 * Encriptación AES-GCM para tokens sensibles (Meta access_token).
 *
 * - Usa Web Crypto API (compat Cloudflare Workers)
 * - Clave derivada con PBKDF2 desde JWT_SECRET + sal fija "vendepro-token-encryption"
 * - Almacenado como `iv:ciphertext` ambos en base64
 *
 * NOTA: La sal fija acopla la encriptación al JWT_SECRET. Si el secret rota,
 * los tokens encriptados se invalidan y deben re-ingresarse desde la UI.
 */

const ENCRYPTION_SALT = 'vendepro-token-encryption'
const PBKDF2_ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256
const IV_LENGTH_BYTES = 12 // recomendado para AES-GCM

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]
    if (byte === undefined) continue
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(secretKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(ENCRYPTION_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encripta `plaintext` usando AES-GCM.
 * Devuelve string en formato `iv_base64:cipher_base64`.
 */
export async function encrypt(plaintext: string, secretKey: string): Promise<string> {
  if (!plaintext) return ''
  if (!secretKey) throw new Error('encrypt: secretKey es requerido')

  const key = await deriveKey(secretKey)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
  const enc = new TextEncoder()
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  const cipherBytes = new Uint8Array(cipherBuf)
  return `${bytesToBase64(iv)}:${bytesToBase64(cipherBytes)}`
}

/**
 * Desencripta el formato `iv_base64:cipher_base64`.
 * Devuelve null si el ciphertext es inválido o falla la verificación AES-GCM.
 */
export async function decrypt(ciphertext: string, secretKey: string): Promise<string | null> {
  if (!ciphertext) return null
  if (!secretKey) throw new Error('decrypt: secretKey es requerido')

  const parts = ciphertext.split(':')
  if (parts.length !== 2) return null
  const ivPart = parts[0]
  const cipherPart = parts[1]
  if (!ivPart || !cipherPart) return null

  try {
    const iv = base64ToBytes(ivPart)
    const cipherBytes = base64ToBytes(cipherPart)
    const key = await deriveKey(secretKey)
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes,
    )
    return new TextDecoder().decode(plainBuf)
  } catch {
    return null
  }
}
