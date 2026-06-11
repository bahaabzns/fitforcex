# Subdomain Routing — Client Portal

> How the client portal is reached at `slug.fitforce.io` instead of `fitforce.io/portal/slug`.

## Architecture (chosen approach)

| Surface | Where it lives | Why |
|---|---|---|
| Marketing / signup | `fitforce.io` (root) | Public, shared |
| Coach dashboard | a single shared app host, workspace chosen by switcher | Coaches manage multiple workspaces; switching via a dropdown beats redirecting between subdomains |
| **Client portal** | **`slug.fitforce.io/portal`** | The white-label surface a coach's clients see; custom-domain-ready later |

The coach dashboard was **not** moved to subdomains. The active workspace already comes
from the JWT, so the dashboard works on one host with a workspace switcher.

Custom domains (e.g. `clients.acmefitness.com`) are a **future feature** — they are
cross-site from the API, so the portal cookie becomes third-party and needs a different
auth carrier. Not in scope here.

## How it works

1. **CORS allows workspace subdomains.** `server/src/lib/cors.ts` (`isAllowedOrigin`) accepts
   the root domain and any `*.<ROOT_DOMAIN>` origin, used by both Express and Socket.IO.
2. **The portal reads its slug from the hostname.** `client/lib/coachSlug.js`
   (`getCoachSlugFromHost`) turns `acme.fitforce.io` into `acme`. The login page sends that
   slug to `/api/client-portal/login`, which maps slug → workspace (unchanged server logic).
3. **The portal cookie is unaffected by the frontend host.** `client_token` is set by the API
   host and sent back to it; `acme.fitforce.io` and `api.fitforce.io` are same-site, so the
   existing `httpOnly` cookie keeps flowing.
4. **Old links redirect.** `fitforce.io/portal/<slug>` (the old path form) redirects to
   `https://<slug>.fitforce.io/portal`.

## Environment variables

| Variable | Where | Dev default | Production |
|---|---|---|---|
| `ROOT_DOMAIN` | server | `localhost` | `fitforce.io` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | client | `localhost` | `fitforce.io` |

Both default to `localhost` so local development needs no extra config.

## Production DNS / TLS

- **Wildcard DNS:** `*.fitforce.io` → the app (in addition to the apex `fitforce.io`).
- **Wildcard TLS:** a certificate covering `*.fitforce.io` (and `fitforce.io`).

## Local development

Chrome (and most modern browsers) resolve `*.localhost` to `127.0.0.1` automatically — no
hosts-file edits needed.

```
http://acme.localhost:3000/portal     # portal login for workspace "acme"
http://localhost:3000/login           # coach dashboard (unchanged)
```

Replace `acme` with a real workspace slug from your database.

## Deferred / follow-up work

- **Bare-subdomain root → portal.** Visiting `slug.fitforce.io/` (no `/portal`) currently shows
  the landing page. A `proxy.ts` rewrite would send it to `/portal`. Deferred until
  `next` is upgraded `16.2.4 → 16.2.9` (the 16.2.4 proxy-bypass CVEs are logged in DEBT.md).
  The proxy must stay cosmetic — auth is always enforced server-side, never by the proxy.
- **Custom domains** per workspace — separate future feature (see above).
