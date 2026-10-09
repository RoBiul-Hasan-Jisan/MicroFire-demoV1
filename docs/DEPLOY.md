# Deploying the site

The site is a standard Next.js app in `apps/web`. The simplest route is Vercel (free tier).

1. Push the repository to GitHub.
2. In Vercel: New Project, import the repo, set **Root Directory** to `apps/web`. Framework preset: Next.js. No build override needed.
3. Environment variables: only needed for the live Ask page. Set `OPENAI_API_KEY` (optionally `OPENAI_MODEL`) or `ANTHROPIC_API_KEY` in Vercel; `app/api/ask/route.ts` uses whichever is present. Without a key there is no provider. Do not commit keys. Optional: `ASK_RATE_LIMIT` (requests per window, default 8).
4. Deploy. Then run `node apps/web/scripts/smoke.mjs https://<your-url>` to check every route.

Local check first: `cd apps/web && npm install && npm run build && npx next start -p 3111`, then `node scripts/smoke.mjs`.
The film file in `apps/web/public` is large; if the host limits file size, host the video elsewhere and link it.
