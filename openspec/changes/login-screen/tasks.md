## 1. Server

- [x] 1.1 `auth.rs`: per-address attempt tracking, 401 `attemptsLeft`, 429 `locked_out` with `Retry-After`;
      verify unit/`oneshot` tests for lockout, expiry and unaffected cookies
- [x] 1.2 Session kinds (30 d persistent vs 12 h session cookie); verify cookie attributes in tests
- [x] 1.3 `torrentx-server auth reset` (+ `--force`, loopback guard, no-op when off); update
      `docs/linux-service.md`; verify command tests
- [x] 1.4 Verify `cargo test --workspace` passes

## 2. UI

- [ ] 2.1 `Login.tsx` per screen 20: notice, card, show/hide, remember, Sign in ⏎, reset hint; verify layout
      in dark and light against the canvas
- [ ] 2.2 States: invalid (red border, attempts, value kept), locked out (live countdown), expired (return
      path), auth disabled (never shown), desktop never shown; verify each manually
- [x] 2.3 `api-client` typed `locked_out`; i18n keys in six dictionaries; verify `pnpm lint`, `pnpm
      typecheck`, `pnpm test` pass
