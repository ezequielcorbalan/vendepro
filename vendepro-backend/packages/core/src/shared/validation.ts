// Input validation helpers for API routes

export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return true // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return true // optional field
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 6 && digits.length <= 15
}

export function validateRequired(value: any, fieldName: string): string | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} es obligatorio`
  }
  return null
}

export function validateEnum(value: string | null | undefined, allowed: string[], fieldName: string): string | null {
  if (!value) return null // optional
  if (!allowed.includes(value)) {
    return `${fieldName} inválido: "${value}". Valores permitidos: ${allowed.join(', ')}`
  }
  return null
}

export function validateDate(value: string | null | undefined, fieldName: string): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return `${fieldName} debe ser formato YYYY-MM-DD`
  }
  return null
}

// Returns first error or null if valid
export function validate(...checks: (string | null)[]): string | null {
  return checks.find(c => c !== null) || null
}
