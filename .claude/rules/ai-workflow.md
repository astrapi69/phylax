# AI Workflow

How Claude Code should operate inside this repo.

## Session start

On the first message of a session:

1. Read `docs/ROADMAP.md` (current state, open tasks).
2. Check recent changes: `git log --oneline -10`.
3. Run `make test` to confirm a green baseline.
   Only then begin the actual task.

## Interpreting "continue" / "next task"

When the user says "continue", "next task", "weiter", or similar:

1. Read `docs/ROADMAP.md`, section "Next Steps".
2. Name the first open item (unchecked checkbox) by its task ID.
3. Wait for confirmation. Do NOT start implementing immediately.

## Order of work for a new feature

1. Decide which layer the feature belongs to (UI, domain, storage, crypto).
2. Look at existing patterns in the same layer before writing new ones.
3. Define types first (`domain/<feature>/types.ts`).
4. Write or extend the repository (storage layer).
5. Write the domain logic (validation, transformations).
6. Build the React feature folder (`features/<feature>/`).
7. Write tests in parallel, not after.
8. Add i18n strings in DE and EN.
9. Commit with a Conventional Commit message including the task ID.

## Order of work for a crypto change

Crypto changes are special. Order is mandatory:

1. State the security goal in plain language.
2. State the threat model delta (what new threat is mitigated, or what existing one is now broken).
3. Write the test FIRST, including a negative test (wrong key fails).
4. Implement.
5. Run the full test suite, not just the crypto tests.
6. Document the change in `docs/decisions/` as an ADR.

## Forbidden actions

- Adding a dependency without explicit approval.
- Writing plaintext to IndexedDB, even temporarily.
- Adding `console.log` of decrypted user data.
- Calling third-party APIs at runtime except for user-initiated AI requests with the user's own API key (Phase 3 onward).
- Generating medical advice, diagnoses, or interpretations of health data via heuristics in code.
- Using em-dashes in any output (code, docs, commit messages).
- Bypassing the repository layer to read or write Dexie directly from a component.
- Deferring frontend test work as a default, including writing audit reports that list frontend gaps as a lower tier than backend gaps.

## Required actions

- Ask before guessing on architectural questions.
- List edge cases before implementing them.
- Justify every security-relevant decision in the PR description or commit body.
- Use Make targets for all build, test, lint, format, and dev commands. Do not invoke npm scripts directly except inside the Makefile itself, inside `package.json`, inside Playwright's `webServer.command` (where direct child-process management requires bypassing the Makefile wrapper), and inside CI workflow steps that run in a container image which does not ship `make` (the official Playwright images in particular). The Makefile rule targets developer-machine consistency; non-interactive CI environments do not participate in that consistency and should not incur an apt install just to preserve the wrapper.
- When touching `src/crypto/` or `src/db/`, run `make test` AND `make test-e2e` before committing.
- When adding a new profile section or observation type, verify the round-trip: create, encrypt, persist, fetch, decrypt, render.
- When building AI features, ensure chat messages are ephemeral (never persisted) and only user-confirmed profile fragments are saved.

## How to handle ambiguity

If a task in ROADMAP.md is ambiguous, do not invent a scope. Ask one targeted question, then wait. Bad: "I assumed you wanted X, so I built X, Y, and Z." Good: "Task E-04 says 'add medication reminders'. Should reminders be local-only browser notifications, or out of scope for the MVP?"

## Commits

- One commit per task ID where possible.
- Conventional Commits format: `feat(profile): add observation CRUD [O-04]`.
- The task ID in square brackets is mandatory.
- No co-author lines, no AI attribution in commit messages.

## Running a coverage audit

1. Check if `docs/audits/current-coverage.md` exists.
2. If it exists, read its "Audit date" header, then `git mv` it to `docs/audits/history/YYYY-MM-DD-coverage.md` using that date.
3. Write the new audit to `docs/audits/current-coverage.md`.
4. When prioritizing gap closure, list frontend and backend gaps in the same priority queue sorted by risk, not by layer. Do not batch all backend gaps first.
