# Auth & Security Rules

- Custom auth with SHA-256 + salt + session cookie
- Cookie name: reportes_session
- Salt: reportes-mg-salt-2026
- All API routes: check getCurrentUser(), return 401 if null
- Middleware protects dashboard routes, allows public /r/ and /t/ routes
- Role-based access: admin sees all, agent sees own data
- Never trust client-side role claims
- Validate permissions before mutations
- Don't expose internal IDs or sensitive data in public routes
- ANTHROPIC_API_KEY stored as Cloudflare Worker secret
