'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { MODULES_FALLBACK, type OrgModulesState } from '@/lib/modules'

/**
 * Estado de los módulos del plan, resuelto en el layout del servidor y bajado
 * una sola vez por render. Lo consumen el menú lateral y las pantallas
 * bloqueadas, que son componentes de cliente.
 */
const ModulesContext = createContext<OrgModulesState>(MODULES_FALLBACK)

export function ModulesProvider({ value, children }: { value: OrgModulesState; children: ReactNode }) {
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>
}

export function useModules(): OrgModulesState {
  return useContext(ModulesContext)
}
