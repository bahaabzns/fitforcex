> http://localhost:3000/clients/[id]\
# add metrics in clients overview pages
# add top bar contains client personal info and make them shared between all client details pages
# responsiveness in builders
# enhance the appearance of triple panels

# add dark mode

# modify `search food items` and `add exercises`  modals

# unify all tabels in the sysyem (client details transactions details) and define the default sorting

# unify action buttons in all tables
# add subtitle in all pages to explain what is this page for
# add arabic language feature


### Week 1 — Stop the bleeding
1. **PR #1:** Drop `plain_password` column. Remove from `mapClient()`. Write a migration.
2. **PR #2:** Gate `/uploads` with auth middleware. Remove the `express.static` line.
3. **PR #3:** Fix client portal login query. Add `UNIQUE(coach_id, email)` constraint.
4. **PR #4:** Add `express-rate-limit` to both login endpoints. Fix cookie flags (`sameSite`, `secure`). Fix JWT/cookie expiry to 7d/7d.
5. **Rotate** the current JWT secret and DB password — even if `.env` isn't in git, the values are known to anyone who's seen the repo.

### Month 1 — Make it safe to ship
6. Adopt `node-pg-migrate`. Convert all the inline `CREATE TABLE IF NOT EXISTS` blocks into numbered migration files.
7. Add `pino` for structured logging. Remove all `console.log` that touches user data.
8. Add `express-validator` or `zod` — at minimum on register, client create, and transaction create.
9. Write 20 unit tests for `computeSubscriptionStatus` covering all the edge cases in `subscription-logic.md`.
10. Add startup env-var validation. Add a real health check that pings the DB.
11. Fix the REST violations in `PUT /api/transactions` and `DELETE /api/transactions`.
12. Add the 8 missing DB indexes listed in PERF-4.

### Quarter 1 — Make it ready to grow
13. Extract a `services/` layer: `subscriptionService.js`, `clientService.js`, `transactionService.js`. Move business logic out of route handlers.
14. Add integration tests for the core flows: auth, client create, transaction create, subscription status computation.
15. Set up CI (GitHub Actions): lint, test, schema validation on every PR.
16. Add Sentry (or equivalent) for production error tracking.
17. Implement API versioning with `/v1/` prefix.
18. Implement proper feature gates for plan limits (client count cap, etc.) in the service layer — do not leave this as UI-only.
19. Migrate to TypeScript — start with the server and the domain objects.
20. Write the README, the API docs (Postman collection is fine), and document the forms system.