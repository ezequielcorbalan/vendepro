'use client'

import { useState } from 'react'
import { HelpCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'

/**
 * "Cómo funciona" al pie del panel.
 *
 * Existe porque varios números de esta pantalla son el resultado de una
 * decisión de cálculo que no se adivina mirándolos: el gasto de portales se
 * prorratea, el CPL tiene dos bases distintas, el período anterior no es el mes
 * entero, y la atribución matchea por nombre de campaña. Si el usuario no sabe
 * eso, o desconfía del panel o —peor— confía en un número que no significa lo
 * que cree.
 *
 * Arranca colapsado: es para consultar, no para leer todos los días.
 */

interface Item {
  q: string
  a: React.ReactNode
}

const COMMON: Item[] = [
  {
    q: '¿Qué período estoy mirando?',
    a: (
      <>
        Mes, trimestre y año son <b>de calendario y hasta hoy</b>: «Mes» es del día 1 al día de hoy,
        no los últimos 30 días. La comparación de arriba es contra <b>la misma cantidad de días</b> del
        período anterior — si hoy es 7, se compara contra los primeros 7 días del mes pasado, no contra
        el mes completo. Comparar 7 días contra 30 daría siempre una caída.
      </>
    ),
  },
  {
    q: '¿Por qué hay dos secciones?',
    a: (
      <>
        Porque son dos negocios distintos y sumarlos no dice nada. <b>Captación</b> es conseguir
        propietarios que quieran vender: el resultado es una propiedad captada.{' '}
        <b>Demanda</b> es conseguir compradores para las propiedades que ya tenés: el resultado es una
        visita, una oferta y un cierre. Un lead de cada uno vale cosas distintas y cuesta cosas
        distintas.
      </>
    ),
  },
]

const CAPTACION: Item[] = [
  {
    q: '¿De dónde salen los datos de las campañas?',
    a: (
      <>
        El gasto, las impresiones y los clicks los trae Meta en vivo desde tu cuenta publicitaria, con
        una demora de hasta 15 minutos. Los leads y las captaciones salen del CRM.
      </>
    ),
  },
  {
    q: '¿Cómo se sabe qué lead trajo cada campaña?',
    a: (
      <>
        Se matchea el <b>nombre</b> de la campaña en Meta contra el origen que quedó guardado en el
        lead. Es la parte más frágil de todo el panel: si renombrás una campaña en Ads Manager, sus
        leads dejan de matchear y la fila queda con «Leads CRM» en cero. Por ahora, no renombres
        campañas que estén corriendo.
      </>
    ),
  },
  {
    q: '¿Por qué hay dos columnas de CPL?',
    a: (
      <>
        Porque son dos números distintos y mezclarlos hace que las filas no se puedan comparar entre sí.{' '}
        <b>CPL (CRM)</b> es el gasto dividido los leads que de verdad entraron al CRM.{' '}
        <b>CPL (Meta)</b> es el gasto dividido lo que Meta dice que trajo. El de Meta suele ser más
        optimista: cuenta formularios que nunca llegaron a ser un lead trabajable.
      </>
    ),
  },
  {
    q: '¿Qué son los "eventos enviados a Meta"?',
    a: (
      <>
        Cada vez que un lead avanza de etapa, el CRM le avisa a Meta desde el servidor. Sirve para que
        Meta aprenda a buscarte gente parecida a la que te termina firmando, en vez de gente que
        simplemente completa formularios. Se configura en Ajustes → Marketing.
      </>
    ),
  },
]

const DEMANDA: Item[] = [
  {
    q: '¿De dónde sale el gasto de los portales?',
    a: (
      <>
        Lo cargás vos, una vez por mes. Los portales no tienen una API de facturación, así que no hay
        forma de traerlo solo: son tres o cuatro números por mes y sin ellos no se puede calcular
        ningún costo.
      </>
    ),
  },
  {
    q: '¿Por qué el gasto no coincide con la factura del portal?',
    a: (
      <>
        Porque se <b>prorratea por los días del período</b>. La factura es de todo el mes, pero si vas
        por el día 7 sólo pasaron 7 días de leads: comparar la factura entera contra una semana de
        consultas te daría un costo por lead cuatro veces más alto del real. Cuando el mes termina, el
        número coincide con la factura. Las filas prorrateadas llevan un asterisco.
      </>
    ),
  },
  {
    q: '¿Con qué dólar se convierte?',
    a: (
      <>
        Con el blue del día en que cargaste el gasto, y <b>queda congelado ahí</b>. Un gasto de julio
        tiene que seguir valiendo lo que valía en julio: si se recalculara con el dólar de hoy, el
        costo por lead del pasado cambiaría solo cada mañana. Si el día que lo cargaste no se pudo
        obtener la cotización, la fila queda sin convertir y te lo avisa — nunca se inventa un número.
      </>
    ),
  },
  {
    q: '¿Por qué hay portales sin costo por lead?',
    a: (
      <>
        Cada celda vacía dice qué le falta. <b>Falta cargar el gasto</b>: el portal trajo consultas
        pero nadie cargó lo que se paga. <b>Falta la cotización</b>: hay gasto en pesos sin dólar del
        día. <b>Sin leads en el período</b>: pagaste y no entró ninguna consulta — que es en sí mismo
        el dato más importante de la tabla.
      </>
    ),
  },
]

export default function HowItWorks({ pipeline }: { pipeline: 'vendedor' | 'comprador' }) {
  const [open, setOpen] = useState(false)
  const items = [...COMMON, ...(pipeline === 'vendedor' ? CAPTACION : DEMANDA)]

  return (
    <Card className="bg-gray-50/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center justify-between w-full gap-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <HelpCircle className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <Heading level={4}>Cómo funciona</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">
              De dónde sale cada número de esta pantalla
            </Text>
          </div>
        </div>
        <ChevronDown
          className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
          {items.map(item => (
            <div key={item.q} className="max-w-3xl">
              <Text weight="semibold" className="text-ink">{item.q}</Text>
              <Text size="sm" tone="muted" className="mt-1">{item.a}</Text>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
