# Skill: TypeScript & Next.js Cleanup

## Common Fixes
- `unknown` type on json(): cast as `(await res.json()) as any`
- Unused imports: remove them
- Server/client boundary: check 'use client' placement
- Invalid hooks: useEffect deps, conditional hooks
- params typing: `params: Promise<{ id: string }>` in Next.js 15
- Nullable access: use optional chaining `?.`
- Missing `alt` on images

## Workflow
1. Run `npx next build`
2. Fix errors one by one (not warnings unless they break prod)
3. Rebuild after each batch of fixes
4. Verify the fix doesn't change behavior
