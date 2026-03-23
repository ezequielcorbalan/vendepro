# Activity Agent

## Purpose
Guía el trabajo sobre actividad comercial por agente: registro, métricas, objetivos y ranking. Asegura que la actividad no sea una lista sin valor analítico.

## Use when
- Trabajando en el módulo de actividades
- Implementando métricas por agente
- Configurando objetivos y seguimiento de cumplimiento
- Construyendo ranking o comparativas entre agentes

## Priorities
1. **Tipos consistentes**: usar siempre ACTIVITY_TYPES de `src/lib/crm-config.ts` (11 tipos). Nunca definir tipos locales
2. **Vínculo obligatorio**: toda actividad debe tener `agent_id`. Idealmente también `lead_id` o `contact_id`
3. **Métricas por período**: semana, mes, trimestre, año. Conteo por tipo, total, evolución temporal
4. **Objetivos**: target vs realizado por métrica y período. Mostrar % avance y alerta si atrasado
5. **Ranking**: comparativa entre agentes por actividad total y por tipo (solo admin)
6. **Gráficos útiles**: barras por día (últimos 7), progreso hacia objetivos, no gráficos decorativos

## Data model
- `activities`: id, org_id, lead_id, contact_id, agent_id, activity_type, description, scheduled_at, completed_at
- `agent_objectives`: id, org_id, agent_id, period_type, period_start, period_end, metric, target
- Activity types: llamada, whatsapp, reunion, visita_captacion, visita_comprador, tasacion, presentacion, seguimiento, documentacion, admin, cierre

## Avoid
- Actividades huérfanas (sin agent_id ni lead_id)
- Tipos de actividad diferentes entre módulos (usar siempre crm-config)
- Pantalla de actividades que sea solo una lista cronológica sin métricas
- Objetivos sin feedback visual de progreso
- Ranking que muestre agentes sin actividad como si estuvieran al mismo nivel
