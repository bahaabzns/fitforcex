# Fixing the recurring "404 page not found" in dev (Turbopack ghost 404)

> Symptom: a route that exists in source (e.g. `/{slug}/clients/{id}/nutrition`) returns
> **404 page not found** in the browser, even though the page file is right there. It tends to
> appear **after you modify some other file** and hard-refresh / open the URL directly.

## What is actually happening (root cause)

We run `next dev` with **Turbopack** (Next 16). In dev, routes are compiled **on demand**, and the
router resolves every incoming request against one consolidated file:

```
client/.next/dev/server/app-paths-manifest.json
```

The bug: Turbopack sometimes **stops updating that consolidated manifest** while it keeps writing
each route's *own* compiled artifacts. So you end up with:

- `client/.next/dev/server/app/(coach)/.../nutrition/page.js`  ← compiled, exists on disk
- but the route is **missing from `app-paths-manifest.json`**  ← the file the router reads

Result: the router has no entry for the path → it returns 404 **without even trying to recompile**.
It is **not** a code error — all imports resolve, the page is valid.

How we proved it (for the record):

```
# manifest last written 01:06, nutrition artifact written 03:26 → 2h out of sync
ls .next/dev/server/app-paths-manifest.json                 # 01:06
ls ".next/dev/server/app/(coach)/.../nutrition/page.js"     # 03:26  (newer!)

grep nutrition .next/dev/server/app-paths-manifest.json     # (nothing — not registered)
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/<slug>/clients/<id>/nutrition        # 404
```

Why it recurs "after most code modifications": editing an unrelated file triggers a Turbopack
rebuild that can drop not-currently-active routes out of the consolidated manifest. The next direct
load of one of those routes then 404s.

---

## Fix it in 1 second (do this first)

**Touch (re-save) the page file of the broken route.** That forces Turbopack to recompile *that*
route and rewrite the manifest with its entry.

In the editor: open the route's `page.js`, add/remove a space, save.

Or from a terminal in `client/`:

```bash
# Git Bash
touch "app/(coach)/[workspaceSlug]/clients/[id]/nutrition/page.js"
```

```powershell
# PowerShell
(Get-Item "app/(coach)/[workspaceSlug]/clients/[id]/nutrition/page.js").LastWriteTime = Get-Date
```

Then refresh the browser. It will be back. (Verified: this took the route from 404 → 200 and added
`nutrition` to the manifest.)

> Tip: navigating to the route via an **in-app link** instead of a hard browser refresh also
> usually recompiles it. The 404 mostly bites on direct URL loads / hard refresh.

---

## If touching the file doesn't fix it (nuclear option)

Clear the dev cache and restart **only the client** dev server. The backend server can keep running.

```powershell
# from repo root (d:\fitforce-x), in PowerShell

# 1. stop the Next dev server (find the start-server.js / `next dev` node process)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'next(\\|/)dist.*dev|start-server\.js' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# 2. delete the client build cache
Remove-Item -Recurse -Force d:\fitforce-x\client\.next

# 3. restart
Set-Location d:\fitforce-x\client; npm run dev
```

A full `rm -rf client/.next` + restart always clears it because the manifest is regenerated from
scratch on boot.

---

## Why we did NOT "permanently fix" it in config

This is an upstream Turbopack dev-server bug, not something in our code. The Next 16 Turbopack
config in this version exposes **no** toggle that reliably disables the offending manifest caching,
so adding a speculative config flag would be cargo-culting. The two fixes above are the supported
remedies. If Next ships a fix or a relevant flag in a later minor, revisit this doc.

## Quick reference

| | |
|---|---|
| **Symptom** | 404 on an existing route after editing unrelated code / hard refresh |
| **Cause** | Stale `client/.next/dev/server/app-paths-manifest.json` (Turbopack dev) |
| **1-sec fix** | Re-save (touch) the broken route's `page.js` |
| **Hard fix** | Stop client dev server → `rm -rf client/.next` → `npm run dev` |
| **Not the cause** | Your code, imports, the `proxy.js` rewrite (it passes `localhost` through) |
