# Phylax i18n Strategy

**Document purpose**: Strategic reference for internationalization when the time comes. Not a task list - a planning document that captures the approach, scope, and sequence for adding English (and potentially other languages) to Phylax.

**Current state**: Phylax v1.0.0 ships with German UI only. All user-facing strings are hardcoded German. System prompts for AI are German. Parser expects German keywords ("Beobachtung", "Supplemente", etc.). Documentation (README, DONATE, CHANGELOG, SECURITY) is already in English.

**User rationale for English support**: Lebende Gesundheit articles exist in both German and English, meaning the conceptual foundation has bilingual reach. English UI would enable Phylax to serve the same audience that has read the English articles.

---

## Scope of full i18n

i18n is larger than "translate UI strings". Complete scope includes:

**UI layer**:

- All user-facing text in React components (~400-600 strings estimated)
- Error messages
- Form labels and placeholders
- Button labels
- Confirmation dialogs
- Toast notifications
- Empty-state messages

**AI layer**:

- System prompts (AI-03, AI-04, AI-06, AI-07, AI-09)
- Parser instructions for output format
- AI response language (responds in user's chosen language)
- NICHT_VERARBEITBAR fallback marker (language-specific)

**Parser layer**:

- Markdown section keywords ("Basisdaten" vs "Base data")
- Field markers ("Beobachtung:" vs "Observation:")
- Parser flexibility: accept both German and English keywords, or switch based on language setting

**Data layer**:

- Date formatting (DD.MM.YYYY vs MM/DD/YYYY)
- Number formatting (1.234,56 vs 1,234.56)
- Units (already universal: g, kg, ml, mg)
- Relative time ("vor 3 Tagen" vs "3 days ago")

**Documentation layer** (already English):

- README.md
- DONATE.md
- CHANGELOG.md
- SECURITY.md

---

## Architectural approach: Wave-based i18n

Full i18n in one task would be 3-5 days of concentrated work with high risk of missing strings. Better: split into four waves, each shippable independently.

### Wave 1: Infrastructure (I18N-01)

**Scope**: Make Phylax "translation-ready" without changing user experience.

**Produces**:

- react-i18next installed and configured
- Translation files structure established
- All hardcoded German strings extracted to `locales/de.json`
- All components use `useTranslation()` hook instead of hardcoded strings
- Browser-language detection infrastructure (defaults to German)
- Language-switcher UI prepared (hidden/disabled without English)

**What user sees**: No change. App still works in German only.

**Why this matters**: Prepares the codebase for translation without committing to specific languages. Future translations become trivial file-adds.

**Estimated effort**: 1.5-2 days

### Wave 2: English Translation (I18N-02)

**Scope**: Add English as a second language.

**Produces**:

- `locales/en.json` with all strings translated
- Language-switcher enabled in Settings
- Browser-language detection respects English
- Date/number formatting via `Intl.DateTimeFormat` / `Intl.NumberFormat`

**What user sees**: Language toggle in Settings. English selection switches entire UI to English.

**Why separate from Wave 1**: Translation work is linear - you can translate on your own time, or hire a translator, without blocking infrastructure.

**Estimated effort**: 1-2 days (translation work)

### Wave 3: AI multilingual (I18N-03)

**Scope**: AI responds in user's language, parser accepts both.

**Produces**:

- German system prompts stay as-is
- English system prompts mirror the German ones (structure + rules)
- Parser accepts both "Beobachtung" and "Observation" keywords
- AI chooses response language based on user's language setting
- Cleanup prompt (AI-09) fallback marker has language-aware variant

**What user sees**: English users get English AI chat. Markdown import accepts English-format profiles.

**Why separate**: Parser changes affect import logic. Needs careful testing against existing test fixtures. Higher risk than UI strings.

**Estimated effort**: 1-2 days

### Wave 4: Content and polish (I18N-04)

**Scope**: Remaining edge cases.

**Produces**:

- Privacy popover content (I-04) in both languages
- Error messages consistently translated
- Date/number formatting locale-aware everywhere
- Any remaining hardcoded strings captured

**What user sees**: Polish - everything feels native in both languages.

**Estimated effort**: 0.5-1 day

**Total effort across all waves**: 4-7 days

---

## Technology choices

### i18n library: react-i18next

**Why**:

- Industry standard for React apps
- Works with TypeScript strict mode
- Supports namespacing (split translations by feature)
- Interpolation (`{{count}}`, `{{name}}`)
- Pluralization rules
- Language detection plugin available
- Bundle size acceptable (~15-20 KB with i18next core)

**Alternatives considered**:

- `react-intl` (FormatJS): more complex, heavier, better for large enterprises
- Custom context-based solution: smaller but reinventing wheels
- `formatjs/intl`: lower-level, doesn't integrate with React hooks natively

### Translation file format: JSON

**Why**:

- Native JSON support, no parsing overhead
- Can be split into namespaces (one file per feature)
- Easy to diff in git
- Tooling ecosystem (Lokalise, Crowdin) speaks JSON
- Linting possible via JSON schema

**Structure**:

```
src/locales/
├── de/
│   ├── common.json         # buttons, navigation, general UI
│   ├── profile.json        # profile view, create form
│   ├── observations.json   # observations-specific
│   ├── ai.json            # AI chat, disclaimers, privacy
│   ├── import.json        # import flow
│   ├── settings.json      # settings screen
│   └── errors.json        # error messages
└── en/
    └── (same structure)
```

Namespaces map to features. Same key across languages. Easy to spot missing translations.

### Language detection priority

1. Explicit user selection (stored in localStorage)
2. Browser language (`navigator.language`)
3. Fallback: German (Phylax's primary audience)

### Language persistence

localStorage key: `phylax-language` with value `'de' | 'en'`. Persists across sessions. Overrides browser detection.

---

## AI-specific considerations

### System prompt translation

Each AI system prompt fragment (from `promptFragments.ts`) needs an English equivalent. The prompts contain:

- Role definitions
- Output format contracts
- Boundary rules
- Fragment structures

**Approach**: translate each fragment once, store both in `promptFragments.ts`:

```ts
export const ROLE_DEFINITION = {
  de: `Du bist ein Strukturierungs-Assistent...`,
  en: `You are a structuring assistant...`,
};
```

System prompt builder picks the right variant based on current language.

### AI response language

Two options:

- A: AI responds in the language of the user's input
- B: AI responds in the language of the user's UI setting

Lean: **B** (UI language). User explicitly chose their language in Settings. Overriding based on input language would be surprising - user types "headache" in English to an English UI and gets German response because they used the German word "Kopfweh" once.

### Parser keyword flexibility

Critical decision: does the parser accept BOTH languages' keywords, or only the UI-language-matching ones?

**Option A: Both always accepted**

- Parser recognizes "Beobachtung:" AND "Observation:" as the same field
- User can import German-formatted markdown into English-UI Phylax (and vice versa)
- More forgiving, better UX
- Slightly more parser complexity

**Option B: Match UI language strictly**

- German UI only imports German keywords
- English UI only imports English keywords
- Cleaner mental model
- Forces re-import if language changes

**Lean: A (both accepted)**. Phylax's tolerant-parser philosophy applies here too. Users shouldn't be punished for having mixed-language data.

### NICHT_VERARBEITBAR fallback marker

The AI-09 cleanup prompt uses "NICHT_VERARBEITBAR" as a fail-signal. This is German.

**Option A**: Universal marker. Use `NOT_PROCESSABLE` regardless of prompt language.
**Option B**: Language-specific. Each language has its own marker.

Lean: **A**. Simpler detection code, no false-negatives from LLM translating the marker.

---

## Rollout strategy

### Phase 1: Preparation (before any code)

- Confirm English is actually needed (user feedback, translation willingness)
- Review Lebende Gesundheit English articles for terminology alignment
- Decide on formal vs informal address (English has fewer options, but still "you" vs "the user")

### Phase 2: Wave 1 (Infrastructure)

I18N-01 commits. Phylax is translation-ready. No user-visible change.

### Phase 3: Wave 2 (Translation)

I18N-02 commits with full English translation. Language switcher enabled.

### Phase 4: Community involvement (optional)

Open translation to community via Crowdin or similar. Translators can contribute French, Spanish, etc. without touching code.

### Phase 5: Waves 3-4 (AI + polish)

AI system prompts, parser flexibility, remaining edge cases.

---

## Risks and mitigations

### Risk: Missing strings

Even with careful extraction, some strings will be missed (rarely-triggered error messages, edge-case UI states).

**Mitigation**: i18next logs warnings when keys are missing. Dev mode shows warnings in console. Tests assert specific strings via keys, not values.

### Risk: Over-translation

Translating too literally produces awkward English (e.g., "Beobachtung speichern" → "Save observation" vs "Save the observation"). German compound words don't always map.

**Mitigation**: Use professional translator OR let native English speaker review. Lebende Gesundheit English articles are good reference for domain terminology.

### Risk: RTL language support

Current architecture assumes LTR (left-to-right). If Arabic or Hebrew are ever added, significant CSS work needed.

**Mitigation**: Out of scope for English-only expansion. Flag for future consideration if RTL languages come up.

### Risk: Translation drift

As features are added, German strings land first, English stays stale.

**Mitigation**: CI check that catches missing keys in non-primary languages. Either fail PR or warn loudly. Translation becomes part of the feature completeness checklist.

---

## When to do this

**Good timing signals**:

- Users explicitly request English
- Server logs show non-German browser languages (if Phylax ever gets analytics)
- GitHub stars/issues show international interest
- Stability in German version (no major refactors planned)

**Bad timing signals**:

- Core features still missing (editing forms, export)
- Active refactoring (strings would move twice)
- No feedback yet from initial German users
- Budget/time constraints (i18n is a 4-7 day investment)

**Phylax current state**: v1.0.0 just launched. Bad timing for i18n. Core features like export are still missing. User feedback has not yet arrived. Better to defer i18n until after Phase 5 (Export) and some user feedback cycles.

---

## References

- react-i18next docs: https://react.i18next.com
- ICU MessageFormat (for complex plurals): https://unicode-org.github.io/icu/userguide/format_parse/messages/
- Crowdin (translation management): https://crowdin.com
- Lebende Gesundheit EN articles: [links from existing README]

---

_This is a strategic reference. When i18n work begins, it splits into I18N-01 through I18N-04 task prompts._
