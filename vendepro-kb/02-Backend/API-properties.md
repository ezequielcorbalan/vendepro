# 🏠 API-properties

Worker de propiedades, fotos, tasaciones, fichas, prefactibilidades, visit forms, reportes.

| Campo | Valor |
|---|---|
| Path | `packages/api-properties/` |
| Subdominio | `properties.api.vendepro.com.ar` |
| Bindings | D1, R2 (`vendepro-assets`), BROWSER (CF Browser Rendering) |
| Secrets | `JWT_SECRET` |
| Env | `API_PUBLIC_URL=https://public.api.vendepro.com.ar` |
| Middleware | cors, error-handler, auth (excepto `/photo/*`) |

## Endpoints

### Property config

| Método | Path | Use case |
|---|---|---|
| GET | `/property-config` | GetPropertyCatalogsUseCase — operation_types + commercial_stages + property_statuses |

### Properties — [[Dominio-Propiedades]]

| Método | Path | Use case |
|---|---|---|
| GET | `/properties` | GetPropertiesUseCase (filters: `?status, ?agent_id, ?neighborhood, ?property_type, ?q, ?commercial_stage, ?operation_type, ?operation_type_id, ?commercial_stage_id, ?status_id`) |
| POST | `/properties` | CreatePropertyUseCase |
| GET | `/properties/:id` | GetPropertyDetailUseCase (incluye fotos) |
| PUT | `/properties/:id` | UpdatePropertyUseCase |
| PUT | `/properties/:id/stage` | UpdatePropertyStageUseCase |
| PUT | `/properties/:id/price` | UpdatePropertyPriceUseCase |
| PUT | `/properties/:id/status` | UpdatePropertyStatusUseCase |
| DELETE | `/properties/:id` | DeletePropertyUseCase |
| GET | `/properties/:id/price-history` | Historial de precios |
| POST | `/properties/:id/price-change` | Registra cambio con razón |
| POST | `/properties/:id/external-report` | MarkExternalReportUseCase |
| DELETE | `/properties/:id/external-report` | ClearExternalReportUseCase |

### Photos

| Método | Path | Notas |
|---|---|---|
| GET | `/photo/:key` | **Público** (sin auth). Proxy a R2 |
| POST | `/photos` | Multipart upload + metadata |
| DELETE | `/photos/:photoId` | |
| PUT | `/photos/reorder` | Reordena fotos |

### Appraisals — [[Dominio-Tasaciones]]

| Método | Path | Use case |
|---|---|---|
| GET | `/appraisals` | GetAppraisalsUseCase / GetAppraisalDetailUseCase (`?id, ?lead_id, ?status`) |
| POST | `/appraisals` | CreateAppraisalUseCase + marketing event |
| PUT | `/appraisals` | UpdateAppraisalUseCase (`?id`) |
| DELETE | `/appraisals` | DeleteAppraisalUseCase (`?id`) |
| POST | `/appraisals/publish` | Genera `public_slug` (`?id`) |
| POST | `/appraisals/comparables` | AddAppraisalComparableUseCase |
| DELETE | `/appraisals/comparables` | RemoveAppraisalComparableUseCase (`?id`) |
| POST | `/appraisals/:id/sync-template` | SyncTemplateSnapshotUseCase |
| PATCH | `/appraisals/:id/blocks/:block_id` | SetBlockOverridesUseCase |
| POST | `/appraisals/:id/pdf` | GenerateAppraisalPdfUseCase (CF Browser Rendering) |

### Fichas — [[Dominio-Tasaciones]]

| Método | Path | Descripción |
|---|---|---|
| GET | `/fichas` | Lista fichas |
| POST | `/fichas` | Crea ficha |

### Prefactibilidades — [[Dominio-Prefactibilidades]]

| Método | Path | Descripción |
|---|---|---|
| GET | `/prefactibilidades` | Lista |
| POST | `/prefactibilidades` | Crea |

### Visit Forms — [[Dominio-Visit-forms]]

| Método | Path | Descripción |
|---|---|---|
| GET | `/visit-forms` | Lista forms |
| POST | `/visit-forms` | Crea form |

### Reports — [[Dominio-Reportes]]

| Método | Path | Descripción |
|---|---|---|
| GET | `/reports` | Lista reportes |
| POST | `/reports` | Crea reporte |

### Landing Templates (legacy aquí, ver también [[API-crm]])

| Método | Path | Descripción |
|---|---|---|
| GET | `/landing-templates` | Lista landing templates |

## Notas

- `/photo/:key` es la **única ruta sin auth** en este worker — sirve fotos públicamente desde R2 para que las muestren los reportes y fichas públicas.
- Generar PDF de tasación es costoso: llama a CF Browser Rendering apuntando a la URL pública renderizada del frontend, espera ~5-15s y guarda el resultado en R2. Cachea por `content_hash` en `appraisal_pdfs` (ver [[Dominio-Tasaciones]]).
