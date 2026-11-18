# Slowness rollout runbook (2026-11-18)

Everything here runs **on the production VPS** (`ssh root@76.13.145.228`, then `su fitforcex` where a step says
so). Nothing in this file has been applied. Do the steps in order, in a quiet window: 03:00-06:00 UTC had no
busy periods in the Nov 17 load history (avoid midnight-01:00 UTC, when the daily jobs run, and the evening
peak). Each step has a check and a way back. Stop at the first check that fails.

Background: one CPU core runs the API, the web app, Postgres and nginx; evenings saturate it. About 30% of
requests are failing `/socket.io` retries and about 40% are "not modified" polls; the API restarts several times a
day when it passes pm2's 800 MB limit. See `DECISIONS.md` (2026-11-18) and `DEBT.md`.

---

## Step 1 — Request timing in the nginx log (5 min, reload only, nothing breaks)

This lets every later step be measured. It writes to a **new** log file and leaves the existing one untouched.

```bash
sudo tee /etc/nginx/conf.d/timing-log.conf >/dev/null <<'EOF'
log_format timed '$remote_addr [$time_local] "$request" $status $body_bytes_sent '
                 'rt=$request_time urt=$upstream_response_time host=$host';
access_log /var/log/nginx/access_timed.log timed;
EOF
sudo nginx -t && sudo nginx -s reload
```

Check (after a minute): `sudo tail -3 /var/log/nginx/access_timed.log` shows lines ending `rt=0.012 urt=0.010 host=...`.

Slowest URLs later:
```bash
sudo awk '{for(i=1;i<=NF;i++) if($i ~ /^rt=/){split($i,a,"="); print a[2], $5}}' /var/log/nginx/access_timed.log \
  | sort -rn | head -20
```

Way back: `sudo rm /etc/nginx/conf.d/timing-log.conf && sudo nginx -t && sudo nginx -s reload`.

> If `nginx -t` complains about a duplicate `access_log`, a server block already defines its own; send me the
> error and the block instead of forcing it.

## Step 2 — Route `/socket.io/` to the API for `my.fitforce.app` (10 min, reload only)

Without this the coach app's Socket.IO client is answered by Next.js (308 then 404) over and over. The API already
serves sockets; nginx just has no rule for the path.

1. Find the block and back the file up:
   ```bash
   sudo grep -n "server_name my.fitforce.app" /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* 2>/dev/null
   # note the file name, then:
   sudo cp /etc/nginx/sites-enabled/<FILE> /root/<FILE>.bak-2026-11-18
   ```
2. In that `server { ... server_name my.fitforce.app; ... }` block, add this **just above** the existing
   `location / {` line (`sudo nano /etc/nginx/sites-enabled/<FILE>`):
   ```nginx
       location /socket.io/ {
           proxy_pass         http://127.0.0.1:4000;
           proxy_http_version 1.1;
           proxy_set_header   Upgrade           $http_upgrade;
           proxy_set_header   Connection        $connection_upgrade;
           proxy_set_header   Host              $host;
           proxy_set_header   X-Real-IP         $remote_addr;
           proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
           proxy_set_header   X-Forwarded-Proto $scheme;
           proxy_read_timeout 3600s;
           proxy_send_timeout 3600s;
       }
   ```
   (`$connection_upgrade` already exists in your config as a `map`. Copy any extra `proxy_set_header` lines that
   the existing `location /api/ {` in the same block has.)
3. Apply:
   ```bash
   sudo nginx -t && sudo nginx -s reload
   ```

Checks:
- `curl -s "https://my.fitforce.app/socket.io/?EIO=4&transport=polling"` returns a short text starting with `0{"sid":`
  (before the change it was a 404 page).
- Within a minute: `sudo tail -n 300 /var/log/nginx/access_timed.log | grep -c "socket.io.* 404"` goes to 0.
- Open the coach messenger in a browser; sending a message from the client portal appears without waiting 30 s.

Way back: `sudo cp /root/<FILE>.bak-2026-11-18 /etc/nginx/sites-enabled/<FILE> && sudo nginx -t && sudo nginx -s reload`.

## Step 3 — Swap file, memory limit and malloc setting (15 min, one API restart)

The API restarts whenever it passes 800 MB (2-12 times a day), and each restart causes 502s and a slow warm-up.
The machine has 2.4 GB free and no swap. This raises the limit, adds a safety net and trims native-memory
fragmentation (the process holds about 70 MB of JavaScript heap but 400-900 MB total).

```bash
# 3a. 2 GB swap (safety net, rarely used)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf && sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
free -m   # Swap: total should show 2047
```
```bash
# 3b. as the pm2 owner (fitforcex): raise the limit, fewer glibc malloc arenas, restart the API once
MALLOC_ARENA_MAX=2 pm2 restart fitforce-api --max-memory-restart 1400M --update-env
pm2 save
pm2 describe fitforce-api | grep -iE "max memory|restarts|status"
```
Also make it permanent in the ecosystem file that pm2 actually uses (the repo folder holds
`ecosystem.config.cjs`, `.js` and `.bak`, so confirm which with `pm2 describe fitforce-api | grep -i "config\|script path"`):
set `max_memory_restart: "1400M"` and `env: { MALLOC_ARENA_MAX: "2" }` for `fitforce-api`, otherwise a later
`pm2 start <ecosystem>` silently goes back to 800 MB.

Check: `curl -s https://api.fitforce.app/api/health` returns `healthy`; after the new API code is deployed (step 5) it
also reports `rssMB`, `externalMB` and `arrayBuffersMB`, which show whether growth is JavaScript or native.
Expect "restarted because it exceeds" lines in `~/.pm2/pm2.log` to drop from several a day to a few.

Way back: `pm2 restart fitforce-api --max-memory-restart 800M --update-env && pm2 save`; `sudo swapoff /swapfile`.

## Step 4 — Postgres: slow-query log (5 min, reload only) and optional cache size

```bash
sudo -u postgres psql -c "ALTER SYSTEM SET log_min_duration_statement = '500ms';" -c "SELECT pg_reload_conf();"
# later, the slowest statements:
sudo awk '/duration:/ {for(i=1;i<=NF;i++) if($i=="duration:") {print $(i+1), $0; break}}' \
  /var/log/postgresql/postgresql-16-main.log | sort -rn | head -20 | cut -c1-260
```
Optional, needs a 2-5 s Postgres restart (do it in the same window as step 3, API reconnects by itself):
```bash
sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = '512MB';"
sudo systemctl restart postgresql
```
Way back: `ALTER SYSTEM RESET log_min_duration_statement;` + reload; `ALTER SYSTEM RESET shared_buffers;` + restart.

## Step 5 — Ship the code branch `fix/api-request-load`

Order matters:
1. **API before web.** The new coach sidebar calls `GET /api/messenger/unread-count`; on an old API it would get a 404
   and show 0 unread. `deploy.sh` rebuilds both, then restarts `fitforce-api` and `fitforce-web` back to back, so
   in practice one deploy is fine; just do not deploy the web part alone.
2. **Migration numbering.** Migration `113_hot_path_foreign_key_indexes.js` needs `111` and `112` (other branches)
   on `main` first, because `node-pg-migrate` refuses to start the API when a lower-numbered migration has not
   run but a higher one has. If those two will not ship soon, rename 113 to 111 before merging.
3. Merge through `dev` into `main` as usual, then run `deploy.sh`. The migration runs at API start
   (it only creates five indexes, milliseconds).
4. Environment variables (optional, defaults are right): `CLIENT_ACCESS_CACHE_TTL_MS` and `SESSION_CACHE_TTL_MS`
   default to 30000; set either to 0 to switch that cache off without a code change.

Checks right after the deploy:
- `curl -s https://api.fitforce.app/api/health` is healthy and includes `rssMB`.
- Log in as a coach: sidebar badge works; log out and confirm the old session no longer works.
- Open the client portal: pages load, notifications dot works.
- `sudo grep -c " 304 " /var/log/nginx/access_timed.log` per hour should fall versus the day before; so should
  `/api/messenger/threads` hits.

Way back: `git revert` the commits on `main` (they are separate) or redeploy the previous tag; migration 113's
`down` drops only the five indexes.

## Step 6 — Measure (next day)

Compare, from `access_timed.log` and `sar`:
- requests per hour and the share of 304/404/308 (was 42% / 18% / 15%);
- median and 95th percentile of `rt=` for `/api/client-portal/*` and `/api/messenger/*`;
- `sar -q` load average at the evening peak (was 3.5-5.5 on one core);
- restarts per day: `grep "exceeds --max-memory-restart" ~/.pm2/pm2.log | cut -c1-10 | sort | uniq -c`.

If the evening load average is still above about 2 after this, the one-core machine is the limit: resize to
2-4 vCPU / 8 GB in the Hostinger panel (a few minutes of downtime; also applies the pending kernel restart).

## Cleanup (not urgent, no speed effect)

- Port 3000 (Next.js) listens on all interfaces; bind it to `127.0.0.1` or block it in the firewall.
- Root can log in over SSH; use a normal user with a key and add fail2ban.
- Database dumps (`*.dump`) sit in `/home/fitforce/app`; move them out of the app folder.
