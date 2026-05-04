# Manual smoke test fixtures

Markdown profile fixtures used by the manual smoke walks. Stable
inputs so a smoke walk can be reproduced without re-typing test
data each time.

## Files

- `profile-a.md` - Baseline profile. 3 observation themes,
  3 lab reports across 3 dates, 7 supplements covering 4 category
  groups (daily / regular / paused / on-demand), 4 open-point
  contexts, 3 warnings. Suitable for P-22b/c/d match-nav and as
  the "target / Profile A" side of IM-05 Option B merge walks.
- `profile-b.md` - Disjoint second profile. 2 observations,
  1 lab report (different date), 3 supplements, 2 open-points.
  Used as the "incoming / Profile B" side of IM-05 Option B merge
  walks; entity counts make additive coexistence easy to verify.

## Usage

Copy a file's contents into the import paste textarea at
`/import` (or the file picker), or pipe via clipboard:

```bash
cat docs/manual-smoke/test-data/profile-a.md | xclip -selection clipboard
```

## Maintenance

- When the parser format changes, update both fixtures in lockstep
  with the smoke files that consume them.
- Keep entity counts disjoint between A and B: the merge smoke
  asserts on additive sums and would silently pass on overlaps.
