import { twMerge } from 'tailwind-merge'

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatCurrency(amount: number, currency: 'USD' | 'ARS' = 'USD'): string {
  if (currency === 'USD') {
    return `USD ${amount.toLocaleString('es-AR')}`
  }
  return `$ ${amount.toLocaleString('es-AR')}`
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  // tailwind-merge resuelve conflictos de utilidades: si dos clases pisan la
  // misma propiedad (ej. font-bold + font-semibold), gana la última. Así los
  // overrides por `className` siempre mandan.
  return twMerge(classes.filter(Boolean).join(' '))
}
