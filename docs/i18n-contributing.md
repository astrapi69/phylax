# Contributing translations to Phylax

Phylax uses [i18next](https://www.i18next.com/) with
[react-i18next](https://react.i18next.com/) for UI strings. Every
user-facing string lives in a JSON file under `src/locales/<lang>/`
keyed by namespace. German is the primary language; additional
languages are welcome.

## Translation file layout

```
src/locales/
└── de/                     # German (primary)
    ├── common.json         # app-wide: buttons, navigation, general dialogs
    ├── onboarding.json     # initial setup, master password, unlock
    ├── profile.json        # profile overview + create form
    ├── observations.json   # observations view + sort controls
    ├── lab-values.json     # lab values view
    ├── supplements.json    # supplements view
    ├── open-points.json    # open points view
    ├── timeline.json       # timeline view
    ├── import.json         # import flow
    ├── ai-chat.json        # chat UI, guided session, commit preview
    ├── ai-config.json      # AI settings, disclaimer, privacy popover
    ├── donation.json       # donation card, reminder, settings section
    ├── settings.json       # settings screen wrapper
    ├── export.json         # profile export dialogs (X-series)
    └── errors.json         # error and validation messages
```

## Key naming convention

Pattern: `namespace.section.specific-string`

Rules:

- lowercase, kebab-case for multi-word segments
- Nest by logical grouping (`buttons`, `header`, `sort`)
- Specific keys, not generic (`donation.card.dismiss-button`, not
  `donation.button-1`)
- Keys describe the slot, not the value. Avoid interpolated pieces in
  key names.

Example:

```json
{
  "buttons": {
    "save": "Speichern",
    "cancel": "Abbrechen"
  }
}
```

Component usage:

```tsx
import { useTranslation } from 'react-i18next';

export function Example() {
  const { t } = useTranslation('common');
  return <button>{t('buttons.save')}</button>;
}
```

## Interpolation and pluralization

Dynamic values use mustache-style placeholders:

```json
{
  "welcome": "Willkommen, {{name}}",
  "version-display": "Version {{version}}"
}
```

Call site:

```tsx
t('welcome', { name: user.name });
```

Pluralization uses i18next's `_one` / `_other` suffixes:

```json
{
  "observations-count_one": "{{count}} Beobachtung",
  "observations-count_other": "{{count}} Beobachtungen"
}
```

i18next auto-selects the suffix based on the `count` value.

## Adding a new language

1. Pick a BCP 47 language code (for example `en`, `fr`, `es`, `el`).
2. Create `src/locales/<code>/` and copy every JSON file from
   `src/locales/de/` into it.
3. Translate the values, leave the keys unchanged.
4. Edit `src/i18n/config.ts`:
   - Add imports for each namespace in the new language.
   - Add a language block to the `resources` object.
   - Add the language code to `SUPPORTED_LANGUAGES`.
   - Drop the hardcoded `lng: 'de'` once multiple languages are wired.
5. Install `i18next-browser-languagedetector` and register it via
   `i18n.use(LanguageDetector)` so the browser language + localStorage
   preference drive initial selection (omitted in I18N-01 for bundle-size
   reasons while German is the only language).
6. Run `npm test` and verify the translation test suite passes.
7. Browser-test: change the language in the Settings screen's
   language switcher (becomes visible once `SUPPORTED_LANGUAGES`
   has more than one entry) and verify the UI renders correctly.

## What stays hardcoded (intentionally)

- AI system prompts in `src/features/ai-config/prompts/promptFragments.ts`
  stay German. The parser and the AI contract both depend on German
  keywords. I18N-03 will revisit if needed.
- Profile-import parser keywords (Beobachtung, Muster, Selbstregulation,
  Status, etc.) stay German. The markdown format is German; the parser
  matches German keywords.
- Markdown export content (`src/features/export/markdownExport.ts`)
  stays German. The exported document is parser-format, not UI.
- Developer-facing strings (error logging, console warnings, test
  descriptions) stay in code.

## Namespace loading strategy

All namespaces load synchronously at app start. There is no lazy
loading. If a future translation matrix grows large (e.g., 20
languages), switch to `i18next-resources-to-backend` or the HTTP
backend, but keep the default synchronous path for the primary
languages the app ships with.

## Questions

Open an issue with the `translation` label at
<https://github.com/astrapi69/phylax/issues>.
