import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

/**
 * ESLint 9 (flat config).
 *
 * `npm run lint` estaba en package.json pero nunca hubo archivo de config, así
 * que el script fallaba siempre. `eslint-config-next` todavía se distribuye en
 * formato eslintrc (no expone flat config), por eso se carga con FlatCompat.
 *
 * `next/core-web-vitals` trae las reglas de React/hooks/a11y de Next;
 * `next/typescript` suma las de @typescript-eslint.
 */
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

export default [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'node_modules/**',
      'next-env.d.ts',
    ],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // El código usa `(await res.json()) as any` por convención (ver
      // doc/frontend.md): las APIs son externas y no hay tipos generados.
      // Prohibirlo sería pelear con una decisión ya tomada del proyecto.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    // Los tests y los scripts de tooling no son código de producto.
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'scripts/**', 'vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]
