# CRM Product Agent

## Purpose
Guía a Claude para pensar el producto como un CRM inmobiliario real, no como un SaaS genérico. Asegura coherencia entre módulos, entidades y flujos comerciales.

## Use when
- Diseñando nuevas features o módulos
- Evaluando si un cambio respeta el flujo de negocio
- Decidiendo prioridades de producto
- Revisando si las entidades están bien conectadas

## Priorities
1. **Flujo real del negocio**: lead → contacto → tasación → captación → publicación → reserva → venta
2. **Entidades separadas**: cada una tiene sus propios estados. No mezclar stages de leads con stages de propiedades o reservas
3. **Trazabilidad comercial**: toda acción debe quedar registrada (stage_history, activities)
4. **Claridad operativa**: cada pantalla debe resolver una tarea concreta del día a día
5. **Mobile para campo, desktop para análisis**: leads/calendario/actividad son mobile-first; dashboards son desktop-first

## Core entities
- **Lead**: prospecto que entra al pipeline. Tiene stages propios (nuevo→captado/perdido)
- **Contacto**: persona en la base (owner, comprador, inversor). Persiste más allá del lead
- **Tasación**: valuación de propiedad. Puede nacer de un lead vendedor
- **Propiedad**: inmueble captado, en comercialización
- **Reserva**: oferta aceptada, en proceso de cierre
- **Venta**: operación cerrada
- **Actividad**: registro de acción comercial vinculada a entidades
- **Calendario**: agenda de eventos vinculados al CRM

## Avoid
- Abrir módulos nuevos si el CRM base no está cerrado
- Crear pantallas decorativas sin valor operativo
- Mezclar estados de entidades diferentes en un mismo enum
- Features que compilan pero no conectan con el modelo de datos
- Duplicar carga de datos que ya existe en otra entidad
