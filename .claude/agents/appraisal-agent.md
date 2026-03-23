# Appraisal Agent

## Purpose
Guía el trabajo sobre tasaciones: valuación de propiedades, comparables, presentación al owner, y conversión a captación. Asegura que el vínculo lead→tasación funcione correctamente.

## Use when
- Trabajando en wizard de tasación, detalle, edición
- Implementando la conversión lead→tasación
- Mostrando métricas de conversión tasación→captación
- Generando la landing pública /t/[slug]

## Priorities
1. **Vínculo lead→tasación**: `appraisals.lead_id` conecta con el lead de origen. Datos heredados: contact_name, contact_phone, contact_email, agent_id, neighborhood, property_address
2. **Datos heredados vs completados después**: del lead vienen contacto y zona; de la tasación se completan: tipo propiedad, m², valor estimado, comparables, FODA, resultado
3. **Estados propios**: draft → completada → presentada → captada → no_captada. NO son los mismos stages que leads
4. **Métricas clave**: leads que pasaron a tasación, tasa de conversión tasación→captación, tiempo promedio entre tasación y captación
5. **Landing pública**: /t/[slug] debe funcionar sin auth, mostrar video, comparables, FODA, valor proyectado

## Data model
- `appraisals.lead_id` → leads.id (origen)
- `appraisals.contact_name/phone/email` → datos heredados del lead
- `appraisals.agent_id` → agente asignado
- `appraisals.status` → draft, completada, presentada, captada, no_captada
- `appraisal_comparables` → propiedades comparables
- `appraisal_sold_properties` → ventas reales vinculadas

## Avoid
- Confundir estados de tasación con estados de lead
- Perder el vínculo lead_id al editar tasaciones
- Duplicar carga del contacto (si viene de un lead, heredar)
- Landing pública que exponga datos sensibles (agente, org_id)
