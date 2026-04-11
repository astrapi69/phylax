# Release Workflow

Permanent workflow for Phylax releases. Read this when a release is on the table.

Prompt triggers: "Release new version", "New release", "Deploy new version".

---

## Core principles

- No manual step gets forgotten: the checklist at the end is mandatory.
- Every release is a logical unit. Do not release in the middle of a feature.
- Tests must be green: red tests block the release, no exceptions.
- CHANGELOG is for humans: do not paste raw commit messages, summarize meaningfully.
- Version bump follows SemVer, even in the 0.x phase.

---

## Step 1: Capture current state

Before any action, show the current state:

```bash
# Latest release tag
git tag --sort=-creatordate | head -5

# Commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  git log ${LAST_TAG}..HEAD --oneline --no-merges
else
  git log --oneline --no-merges
fi

# Working tree status (must be clean)
git status
```

If the working tree is not clean, STOP and ask the user how to proceed.

---

## Step 2: Decide the version bump

SemVer rules for Phylax:
- **patch** (`0.1.0` -> `0.1.1`): bug fixes, dependency updates, doc fixes, no user-visible behavior change.
- **minor** (`0.1.0` -> `0.2.0`): new features, new entry types, new export formats, UI additions. Backward-compatible storage schema.
- **major** (`0.x.y` -> `1.0.0`): first stable release, OR a storage schema migration that requires user action.

Special: any change to the crypto module that affects existing ciphertexts requires a major bump and a migration plan, regardless of how small the diff looks.

State the proposed version bump and wait for confirmation.

---

## Step 3: Run the full test suite

```bash
npm ci                      # clean install
npm run typecheck
npm run lint
npm test -- --coverage
npm run test:e2e
npm run build               # production bundle must build
```

All five must pass. Coverage thresholds (see `quality-checks.md`) must be met.

---

## Step 4: Update CHANGELOG.md

Format: Keep a Changelog (https://keepachangelog.com).

```markdown
## [0.2.0] - 2026-04-15

### Added
- Medication entry type with start/end dates and dosage tracking [E-04]
- PDF export now includes a date range filter [X-02]

### Changed
- Auto-lock default reduced from 10 to 5 minutes [P-07]

### Fixed
- Backup restore failed silently when ciphertext was truncated [B-03]

### Security
- PBKDF2 iterations increased from 310,000 to 600,000 [F-09]
```

Rules:
- Group by Added / Changed / Fixed / Security / Removed.
- Each entry references its task ID in square brackets.
- "Security" entries are mandatory if anything in `src/crypto/` changed.

---

## Step 5: Bump version

```bash
# Edit package.json manually OR
npm version <patch|minor|major> --no-git-tag-version
```

Then commit:

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): v0.2.0"
```

---

## Step 6: Tag and push

```bash
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main
git push origin v0.2.0
```

---

## Step 7: Build and deploy

```bash
npm run build
# Deploy dist/ to GitHub Pages or Cloudflare Pages
# (deployment script TBD, document here once defined)
```

Verify the deployed URL serves the new version: open in incognito, check the version string in Settings, run through the smoke test from `quality-checks.md`.

---

## Step 8: GitHub Release

Create a GitHub Release from the tag. Body = the CHANGELOG section for this version. Mark as "Latest release".

---

## Final checklist (mandatory before declaring "released")

- [ ] Working tree was clean before starting
- [ ] All tests green (unit, E2E, typecheck, lint)
- [ ] Coverage thresholds met
- [ ] CHANGELOG.md updated and grouped correctly
- [ ] Version bumped in package.json
- [ ] Commit `chore(release): vX.Y.Z` exists
- [ ] Git tag `vX.Y.Z` created and pushed
- [ ] Production build succeeds
- [ ] Deployed URL serves the new version
- [ ] Smoke test passed on deployed URL
- [ ] GitHub Release created with CHANGELOG content
- [ ] Any security-relevant change is documented in `docs/decisions/`

If any item is unchecked, the release is NOT done.
