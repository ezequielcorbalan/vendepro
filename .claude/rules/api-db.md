# API & Database Rules

## API Routes
- All routes check getCurrentUser() first
- Filter by org_id on all queries
- Shape responses for UI — include JOINed names, computed fields
- Use query params for filters: ?stage=X&agent_id=Y&start=Z
- Return clean JSON, avoid nested nulls
- Cast all json(): `(await request.json()) as any`

## Database
- D1 access via getCloudflareContext()
- Generate IDs with generateId() (crypto.randomBytes hex)
- Use .prepare().bind().run() for mutations
- Use .prepare().bind().all() for queries, .first() for single
- Handle missing tables/columns gracefully with try/catch
- Timezone: store in UTC, display in local (Argentina = UTC-3)
