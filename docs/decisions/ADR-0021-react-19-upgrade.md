# ADR-0021: React 19 Upgrade

**Date:** 2026-05-02
**Status:** Accepted

## Context

Phylax was bootstrapped on React 18 (see CLAUDE.md "Tech-Stack (fix)"
and `.claude/rules/architecture.md`). React 19 stable has been out
since December 2024. The runtime upgrade landed in commit `9f69132
chore(react): upgrade to React 19.2.5 [TD-02]` on 2026-04-21 without
an ADR; this ADR backfills the decision per
`.claude/rules/coding-standards.md` "Adding a new dependency requires
explicit approval and an entry in `docs/decisions/`" (the rule covers
material version jumps as well as new packages).

The Node 20 LTS EOL motivated the prior Node 24 runtime bump (commit
`83c3db0`); React 19 is the matching client-runtime refresh.

### Options considered

- **Option A (stay on React 18.3)**: zero short-term effort; long-term
  cost is divergence from upstream peer ranges (every modern
  React-adjacent package now ships React-19-compatible peers, and
  back-porting bug fixes to 18.3 is at the maintainers' discretion).
  Rejected.
- **Option B (upgrade to React 19, exact pin)**: matches the locked-
  list pinning style (`@zxcvbn-ts` in ADR-0014). Selected.
- **Option C (upgrade to React 19, caret range)**: the React team's
  release cadence does not warrant a caret here; we want to opt into
  minor bumps explicitly so the bundle and behaviour deltas surface
  in a real PR. Rejected.

## Decision

Upgrade to **React 19.2.5** (exact pin) for both `react` and
`react-dom`. `@types/react` / `@types/react-dom` follow as caret
ranges since type packages are runtime-safe.

### Compatibility audit

All React-adjacent dependencies in package.json declared React-19-
compatible peer ranges at the time of upgrade:

- `react-i18next@17.0.4` - peer `react: >= 16.8.0`
- `@testing-library/react@16.3.2` - peer `react: ^18.0.0 || ^19.0.0`
- `react-markdown@10.x` (ADR-0008) - peer covers React 19
- `react-router-dom@7.x` - peer covers React 19

No collateral upgrades were required.

### Threat-model implications

React 19 ships a new server-rendering surface (`react-dom/server` is
still importable but the recommended entry shifted to `react-dom/
static`). Phylax does not server-render: there is no backend
(Nicht-verhandelbares Prinzip 1) and the production build is a static
SPA bundle. The SSR API change has no surface in this codebase.

The new React 19 hooks (`use`, `useFormStatus`, `useFormState`,
`useOptimistic`, `useActionState`) introduce no new attack surface
relevant to the Phylax threat model (`.claude/rules/architecture.md`
"Threat model"). The auto-lock and crypto-key-in-memory contracts are
unaffected: React state never holds the master key (the key lives in
`src/crypto/keyStore.ts` module scope).

### Migration scope

The migration was zero-edit at the source level: all existing 18.x
APIs in use (functional components, hooks, Context, Suspense) are
forward-compatible. The 19.x deprecation list (legacy Context API,
string refs, `findDOMNode`, `defaultProps` on function components)
contains nothing this codebase used.

## Consequences

### Positive

- Stays on a maintained major; security and bug fixes flow into a
  current branch.
- Aligns with the Node 24 runtime refresh (commit `83c3db0`).
- Unblocks future adoption of React 19-native features
  (`useOptimistic` for the import flow, `use` for resource Suspense)
  if and when they fit a real Phylax requirement.

### Negative

- One major-version risk surface to monitor. Mitigated by the unit
  test suite (2,632 tests as of commit `4388b89`), the production E2E
  suite, and the small public API surface (no class components, no
  legacy patterns).
- Bundle delta is in the noise (React 19's runtime is comparable to
  18.3 within size-limit slack, no budget changes required).

### Reversibility

Reverting requires pinning `react` / `react-dom` back to 18.3.1 and
the matching `@types/react*` ranges. No source code touches React-19-
specific APIs, so a rollback is an `npm install` and a CI re-run.

## References

- Commit `9f69132 chore(react): upgrade to React 19.2.5 [TD-02]`.
- `.claude/rules/coding-standards.md` "Allowed dependencies (locked
  list)" - `react` / `react-dom` line covers both 18 and 19 ranges.
- `.claude/rules/architecture.md` "UI layer" - updated in same commit
  as this ADR.
- `CLAUDE.md` "Tech-Stack (fix)" - updated in same commit as this ADR.
- `README.md` "UI layer" - updated in same commit as this ADR.
