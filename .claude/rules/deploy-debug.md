# Deploy & Debug Rules

## Deploy Flow
1. `npx next build` — check for TS errors
2. Fix any errors (minimal fixes, no refactors)
3. `npx opennextjs-cloudflare build` — generates .open-next/
4. `npx wrangler deploy` — deploys to Cloudflare Workers
5. Verify in production
6. `git add -A && git commit && git push`

## Debug Flow
1. Check browser console for errors
2. `npx wrangler tail --format pretty` for server-side logs
3. Check `/api/debug-env` for environment variables (remove after debugging)
4. Common issues:
   - `unknown` type: cast with `as any`
   - Missing entry-point: run build before deploy
   - D1 errors: check column names match between schema and queries
   - API key issues: check length via debug endpoint

## Rules
- Never open refactors during hotfixes
- Summarize: root cause, files touched, verification steps
- If a pattern repeats, add a rule
