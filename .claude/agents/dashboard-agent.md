# Dashboard Agent

## Purpose
Guía la construcción de dashboards ejecutivos y operativos. Distingue entre el dashboard general del CRM y dashboards por área.

## Use when
- Construyendo o modificando el dashboard principal (/dashboard)
- Creando dashboards por área (reportes, propiedades, vendidas)
- Decidiendo qué KPIs mostrar y cómo organizarlos
- Adaptando dashboards para mobile

## Dashboard types
1. **Dashboard general CRM** (/dashboard): panel ejecutivo de todo el negocio. KPIs de leads, tasaciones, captaciones, actividad, conversión. Funnel completo lead→vendido. Alertas operativas. Performance por agente
2. **Dashboard reportes** (/dashboard/reportes): métricas de propiedades publicadas, portales, competencia. Es un sub-dashboard, NO el principal
3. **Dashboards por agente**: vista personal con mis leads, mi actividad, mis objetivos

## Priorities
1. **KPIs arriba**: 6 cards máximo con los números más importantes del período
2. **Funnel de conversión**: lead→contactado→calificado→en tasación→captado→reservado→vendido (7 etapas)
3. **Alertas operativas**: leads vencidos, seguimientos pendientes, eventos de hoy. Clickeables, llevan al módulo
4. **Actividad del equipo**: gráfico barras últimos 7 días + breakdown por tipo
5. **Performance por agente**: tabla con leads, captaciones, conversión, actividad (solo admin)
6. **Pipeline de leads**: conteo por stage clickeable

## Responsive
- Desktop: grids 2-3 columnas, funnel horizontal, tablas
- Mobile: KPIs 2 columnas, todo apilado, funnel vertical, alertas primero
- No usar tablas horizontales en mobile — convertir a cards

## Avoid
- Dashboard que solo muestra propiedades/reportes (eso va en /dashboard/reportes)
- Gráficos sin datos reales (mejor mostrar "sin datos" que gráficos vacíos)
- Mezclar métricas de áreas diferentes sin separación visual
- KPIs que no se entienden sin contexto (siempre label claro)
- Funnel que no llegue hasta vendido
