# Code Hygiene

Automated enforcement of code quality. These rules make sure the code looks consistent on every commit, regardless of whether a human or an AI wrote it.

## Formatting and linting

### TypeScript and React

`eslint.config.js` (flat config):

```js
import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  ...ts.configs.strict,
  {
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/crypto/internal/*'],
              message: 'Import from src/crypto only via the public index.',
            },
          ],
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
```

### Prettier

`.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Pre-commit hook (Husky + lint-staged)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

A failing lint check blocks the commit. Use `--no-verify` only for hotfixes, never silently.

## Restricted imports (custom ESLint rule)

Two project-specific rules enforced via ESLint config:

1. `crypto.subtle` and the `crypto` global may only be imported in files under `src/crypto/`.
2. The `dexie` package may only be imported in files under `src/db/`.

If a feature needs crypto or storage, it goes through the public API of `src/crypto/index.ts` or `src/db/repositories/`.

## File organization

- One React component per file. File name = component name in PascalCase.
- Index files (`index.ts`) only re-export, no logic.
- Test files live next to the source: `foo.ts` and `foo.test.ts`.
- E2E tests live in `tests/e2e/`.

## Naming

- React components: PascalCase.
- Hooks: camelCase prefixed with `use`.
- Constants: UPPER_SNAKE_CASE.
- Types and interfaces: PascalCase, no `I` prefix.
- File names: kebab-case for non-component files (`entry-repository.ts`), PascalCase for components (`EntryList.tsx`).

## Comments

- Comments explain WHY, not WHAT. The code already shows the what.
- Public functions in `crypto/`, `db/`, and `domain/` need a JSDoc block with parameters, return value, and any security note.
- TODOs include a name or task ID: `// TODO [E-12]: handle empty state`.
- No commented-out code in commits. Use git history.
- No em-dashes in any comment or string.

## Imports

Order enforced by ESLint + Prettier:

1. Node builtins (rare in browser code).
2. Third-party packages.
3. Absolute imports from `@/` (configured as alias for `src/`).
4. Relative imports.

Blank line between groups.

## Dead code

- Unused exports are removed in the same commit that makes them unused.
- `npm run lint` fails on unused variables and imports.
- Quarterly: run a dead-code analyzer (`ts-prune` or similar) and clean up.

## Bundle hygiene

- No moment.js. Use native `Intl.DateTimeFormat` or date-fns if needed.
- No lodash. Use native methods or write a five-line utility.
- No icon libraries beyond `lucide-react` if and when an icon library is added.
- Check bundle size on every PR with `make test-bundle-size`. The size-limit budgets in `.size-limit.json` are the operative gate (T-03, ADR-0010 / 0012 / 0013 / 0015 / 0017 / 0020).
