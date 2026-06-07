# Deploying MyAnalyst to Vercel

This is a **monorepo**. The deployable Next.js app lives in **`apps/web`**, not at the repo root.
That one fact is the cause of almost every "404: NOT_FOUND" you'll see — Vercel built from the root,
found no Next.js app, and served nothing.

## Fix the 404 — set the Root Directory

1. Go to your project on **vercel.com → Settings → Build and Deployment** (or **General**).
2. Find **Root Directory** and set it to:
   ```
   apps/web
   ```
   (Click **Edit**, type or browse to `apps/web`, **Save**.)
3. Make sure **Framework Preset** is **Next.js** (auto-detected once the root is correct).
4. Go to **Deployments → ⋯ on the latest → Redeploy** (uncheck "use existing build cache").

That's it. No environment variables are required for the default build.

### If you're importing the repo for the first time
On the **New Project** screen, click **Edit** next to *Root Directory* and choose `apps/web`
**before** clicking Deploy.

### Or deploy from the CLI (sets the root automatically)
```bash
cd apps/web
npx vercel        # first run links/creates the project
npx vercel --prod # production deploy
```
Running from inside `apps/web` makes that directory the project root.

## Optional — enable AI-narrated insights
Add these in **Settings → Environment Variables** (all optional; without them the local
templated narrator is used). See `apps/web/.env.example` for details.

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_LLM_ENABLED` | `1` | Turns on the LLM path |
| `LLM_PROVIDER` | `groq` | `anthropic` \| `groq` \| `openai` \| `gemini` \| `openrouter` |
| `LLM_API_KEY` | `gsk_…` | Server-side only — never exposed to the browser |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Provider-specific model id |

## Sanity check after deploy
- `/` → landing page
- `/analyze` → the analyzer (try `/analyze?demo=1` for the sample)
- `/api/insights` → returns `{"insights":[],"provider":"none"}` on a POST when no key is set
