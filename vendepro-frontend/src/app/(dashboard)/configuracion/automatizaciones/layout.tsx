import { ModuleGate } from '@/components/modules/ModuleGate'

/** El módulo es parte del plan PRO y se activa a mano por organización. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="automatizaciones">{children}</ModuleGate>
}
