# Skill: Bugfix → Build → Deploy

## Workflow
1. Reproduce the issue (screenshot, error message, console log)
2. Identify root cause (file + line)
3. Apply minimal fix — no refactors
4. `npx next build` — verify it compiles
5. `npx opennextjs-cloudflare build`
6. `npx wrangler deploy`
7. Verify in production
8. Summarize: error, cause, fix, files changed, verification

## Rules
- Don't fix unrelated things
- Don't open new feature work
- If build fails, fix the build error first
- Always verify after deploy
