# Task Series Conventions

Each task is prefixed with a series identifier that indicates its scope.

| Prefix | Name           | Scope                                                         | Status      |
| ------ | -------------- | ------------------------------------------------------------- | ----------- |
| F-     | Foundation     | Phase 1 infrastructure (crypto, auth, routing, app shell)     | Complete    |
| O-     | Object/Domain  | Domain types, repositories, Dexie schema                      | Complete    |
| IM-    | Import         | Markdown import pipeline (parser, transaction, UI)            | Complete    |
| V-     | View           | Read-only UI screens for imported entities                    | In progress |
| T-     | Testing        | Test infrastructure (theme, smoke, bundle-size, mutation)     | In progress |
| I-     | Infrastructure | Runtime, platform, build tools, rules                         | In progress |
| AI-    | AI-Guided      | AI-assisted profile creation and updates (Phase 3)            | Planned     |
| D-     | Document       | Document management features (Phase 4)                        | Planned     |
| X-     | Export         | PDF export and related features (Phase 5)                     | Planned     |
| B-     | Backup         | Backup and restore features (Phase 6)                         | Planned     |
| P-     | Polish         | UI/UX refinement, performance, accessibility (Phase 7)        | Planned     |
| M-     | Multi-Profile  | Multi-profile support (Phase 8)                               | Planned     |
| DP-    | Derived Plans  | AI-derived health plans (Phase 9)                             | Planned     |
| E-     | Edit           | Manual entity creation and editing                            | Planned     |
| R-     | Release        | Repository-level release prep (icons, README, CHANGELOG, tag) | Complete    |
| I18N-  | i18n           | Internationalization: extract strings, switcher, add langs    | In progress |

## Naming rules

- Tasks within a series are numbered sequentially: V-01, V-02, V-03
- Sub-tasks use letter suffixes: IM-03a, IM-03b, T-04a through T-04h
- The ROADMAP groups tasks by series under phase headings
- Commit messages reference the task ID in brackets: `feat(profile-view): ... [V-01]`
- Conventional commit prefixes match the task type:
  - `feat` for features (V-xx, IM-xx, O-xx)
  - `test` for test infrastructure (T-xx)
  - `chore` for infrastructure (I-xx)
  - `docs` for documentation-only changes
  - `fix` for bug fixes
  - `refactor` for I18N-xx extractions that do not change behavior
