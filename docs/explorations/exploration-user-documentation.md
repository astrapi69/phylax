# Phylax User Documentation: Exploration

> Status: Discussion basis, not a final plan
> Date: 2026-04-27
> Iteration: 0 (initial scoping)
> Language: English (for CC readability; the actual user docs will be DE+EN)

## Summary

Phylax has a productive code base (v1.0.0 shipped) but no structured user-facing documentation. The gap grows with feature depth. This document explores options for a documentation approach and proposes a concrete first iteration.

**Recommendation in brief:** A hybrid approach with an MkDocs-based external doc site at `astrapi69.github.io/phylax-docs/` (or analogous to Bibliogon at `help/` setup), in-app help links from relevant screens, and an opt-in onboarding tour for first-time users. Content draws from the existing four-part article series with the planned fifth article as synthesis, all part of the umbrella series "From Theory to Practice".

The docs should be in DE+EN parallel from the start, matching the app's locale support.

---

## 1. User Group Analysis

Phylax serves multiple user types with divergent needs. The docs need to reach all of them without alienating any.

### 1.1 Primary User: Health-Conscious Self-Manager

A person who wants to structurally document their own health data. Medium to high tech affinity (can use a browser, understands "backup", but is not a developer). Wants to use Phylax because:

- Data belongs to them, not to a cloud
- Encryption is communicated comprehensibly
- Input is efficient enough for daily use

What this person needs:
- Quick "First Steps" (from "open Phylax" to "first profile created" in 5-10 minutes)
- Clear explanations of what happens when (e.g., "what if I forget my password")
- Workflows for common tasks: add an entry, import a report, create a backup
- Not too much theory at once, but access to theory when wanted

### 1.2 Secondary User: Tech-Affine Power User

A developer or tech professional who uses Phylax as a tool, possibly self-hosting, possibly contributing to the codebase. Wants:

- Architecture overview
- Threat model
- Self-hosting guide
- API/storage format documentation
- Roadmap and contribution paths

This audience is already well-served by the README + code. Doc contribution here: don't duplicate, but link from user docs to tech docs when someone wants to go deeper.

### 1.3 Tertiary User: Trusted Person (Phase 8)

A person who manages data for someone else (parent for child, adult for a dependent). Multi-profile is Phase 8, so later. Docs can prepare a stub area now, full build-out when Phase 8 lands.

### 1.4 Quaternary User: Curious Observers

Heard about Phylax, wants to understand what it is and whether it's for them. Needs:

- What is Phylax (not: what can Phylax do)
- Why does it exist
- How does it differ from Apple Health, Google Fit, MyFitnessPal etc.
- Conceptual entry point ("Living Health")

This audience often hits the docs as their first touchpoint. The first 30 seconds on the docs landing page have to work for this person.

### 1.5 Prioritization

Phylax is freshly v1.0.0, user base is presumably small. Doc investments need to pay off. Priority order:

1. **1.4 (Curious) and 1.1 (Self-managers)** — combined ~80% of doc traffic
2. **1.2 (Power users)** — link existing material, don't duplicate
3. **1.3 (Trusted person)** — stub for later

The doc architecture should make 1.4 → 1.1 the main path with clear branches for 1.2.

---

## 2. Content Strategy: Anchored to Existing Article Series

### 2.1 Existing Materials

Four existing Medium articles (DE+EN) belong to a series. The series in turn belongs to the umbrella series "From Theory to Practice". A fifth article is planned as synthesis of the first four.

These materials are an asset, not a risk. They provide the theoretical depth that some users seek without overloading the UI docs. The trick is the right linking: UI docs focus on "how to do X", link to articles for "why do X" and conceptual background.

**Confirmed article URLs (from README):**

English (Parts 1-2 translated, 3-4 in progress):
- Part 1: https://asterios-raptis.medium.com/living-health-from-patient-to-partner-9fff311a8c45
- Part 2: https://asterios-raptis.medium.com/living-health-in-practice-d53964053500

German (original, full series):
- Series overview: https://asterios-raptis.medium.com/lebende-gesundheit-die-serie-0193f66df9a3

These are publicly linkable on Medium. No paywall consideration needed for linking.

**Implication for docs:**
- DE docs can link to all four DE articles directly
- EN docs link to Parts 1-2 directly; Parts 3-4 get "translation in progress" disclaimer with a link to the German originals as fallback
- When the planned fifth article (synthesis) ships, both DE and EN docs gain a "deep dive" entry point

### 2.2 Content Backbone (Proposed)

Structured by user journey rather than feature list:

**A. Getting Started**
- What is Phylax (1 page, clear, narrative)
- Why Living Health (link to article series for depth)
- First Steps (5 minutes, guided first impression)
- Understanding Concepts (Profile, Observation, Timeline, Encryption)

**B. Daily Use**
- Recording observations
- Entering lab values
- Managing supplements
- Tracking open points
- Maintaining profile base data

**C. Data Work**
- Importing existing profiles (Markdown format)
- Importing findings via ePA import (Phase 4b)
- Exporting data (Markdown / encrypted)
- Creating and restoring backups

**D. AI Support**
- AI chat for guided input
- When AI helps, when it doesn't
- Configuring API key
- What happens with the data (Privacy)

**E. App Management**
- Switching language
- Setting theme
- Configuring auto-lock
- Reset (full app wipe)
- Master password

**F. Background** (linked external, not extensive in docs)
- Article series on Medium (DE + EN)
- Threat model (link to README/repo)
- Architecture (link to repo docs)
- Roadmap (link to ROADMAP.md)

**G. Help**
- FAQ
- Troubleshooting
- What to do in case of data loss
- Contact / Issues

### 2.3 What the Docs Should NOT Be

- **Not every button gets an explanation.** Self-explanatory UI doesn't need doc duplication.
- **Not a second marketing surface.** README has that, Medium articles have that. Docs are a tool.
- **Not maximum-depth claim.** Whoever wants to go deep goes to code, articles, repo. Docs are action-relevant.

---

## 3. Format Options and Recommendation

### 3.1 Options Comparison

| Option | Advantages | Disadvantages |
|---|---|---|
| Markdown in repo | Version control, PR reviews, Phylax-stack-consistent | Rendered only on GitHub, no search, no in-app access |
| MkDocs Static Site | Search, nice navigation, mobile-friendly, multi-language possible | Build pipeline needed, external URL |
| In-app help view | Contextual, no tab switch, offline | Double maintenance, app bundle grows, no SEO |
| Notion/GitBook | Quick to start, collab features | Lock-in, external dependency, against Phylax privacy-first ethos |
| Onboarding tour | Just-in-time learning, low threshold | Only explains the first step, no reference work |

### 3.2 Recommendation: Hybrid Approach Analogous to Bibliogon

**Confirmed:** Bibliogon's MkDocs setup lives in the `help/` folder of that project and is reusable as a template for Phylax. This saves significant setup work.

Three components that work together:

**Component 1: MkDocs site as canonical reference work.**
- Hosting: GitHub Pages, either at `astrapi69.github.io/phylax-docs/` (separate repo) or as subpath in the Phylax repo
- All content from the backbone (Section 2.2)
- Search, navigation, mobile-responsive
- Versioned via Git
- DE and EN parallel from day one
- Bibliogon-MkDocs setup from `help/` as the starting template — clone, adjust theming/colors/navigation for Phylax, populate content

**Component 2: In-app help links.**
- Small "Help" icon in header or Settings section
- Links to the matching page of the MkDocs site
- Context-sensitive where useful (e.g., from BackupImportSection a "How does backup import work?" link to the corresponding doc page)
- External links instead of in-app rendering: no bundle bloat, no dual maintenance

**Component 3: Opt-in onboarding tour for first-time users.**
- After first setup completion (master password created), offer a tour as opt-in
- 3-4 steps: profile overview, observation entry, backup hint
- Skippable from the start (no "press X to skip" — explicit "Skip tour" button as primary alternative to "Start tour")
- Refers to the full doc site at the end
- Implementation: own feature in `src/features/onboarding-tour/` or as extension of the existing onboarding flow
- **User-confirmed: tour must be offered, not forced.** Setup completion does not block on tour completion.

### 3.3 Why This Hybrid Approach Fits Phylax

- **MkDocs site** is the Phylax-consistent way: Markdown source, Git-versioned, statically generated, no tracking. Matches privacy-first philosophy.
- **In-app links** instead of in-app rendering keep the bundle lean (Phylax watches its bundle budget, currently ~280KB of 380KB). Docs in the bundle would be counterproductive.
- **Onboarding tour** meets users where they first stand. The subsequent doc link leads to deeper sources.
- **Bibliogon pattern as template** saves work: what works there can be reused by Phylax. The `help/` folder convention keeps doc tooling next to but not inside the production code.

---

## 4. Multi-Language Strategy

Phylax is DE+EN active (see I18N-02), with FR/ES/EL planned. Doc languages need to co-evolve with the app.

### 4.1 Decision: DE + EN parallel from the start

Rationale:

1. The app is already bilingual (I18N-02 complete). Single-language docs would be inconsistent.
2. The existing article series is also DE+EN. Reusing content is simplified.
3. MkDocs supports multi-language natively via Material theme plugins (used in Bibliogon's `help/` setup).
4. Maintenance overhead is real but manageable if docs are kept small at the current scope.

FR/ES/EL can join later when the app translations progress and user requests justify it.

### 4.2 Language Consistency Discipline

When DE content changes, EN must catch up before the DE update merges. Otherwise EN docs slowly drift to outdated. This can be enforced by:
- Pre-commit hook checking that DE/EN page pairs both have updated `last_modified` timestamps
- Review checklist on doc PRs
- Or, more pragmatically: a brief CONTRIBUTING note about the convention

The exact enforcement mechanism is its own discussion when iteration 1 starts.

---

## 5. Maintenance and Lifecycle

### 5.1 Who Maintains the Docs

Currently: solo maintainer (Aster). This is real and matches Phylax reality.

Implications for doc design:

- **Docs must not become a chore.** If every bug fix requires a doc update, the docs will burn out and die.
- **High self-explanation threshold for code aspects.** Better no docs than outdated docs.
- **Update trigger per phase, not per commit.** When a phase completes, doc review for affected areas. Not on every small commit.

### 5.2 Update Hooks

Suggestion for the ROADMAP workflow: after each phase completion, a doc-update task. Kept small:

- "Phase 4b ePA Import done" → 1 new doc page "Importing findings via ePA" or update existing page
- "Phase 5 Export done" → update "Exporting data" doc page
- "Phase 8 Multi-profile done" → expand trusted-person section

This keeps doc maintenance proportional to feature work, not overhead-multiplied.

---

## 6. Concrete First Iteration

The exploration document proposes a hybrid approach. The first iteration should prove tractability without getting lost in full build-out.

### 6.1 Iteration-1 Scope (Minimum Viable Docs)

**What goes in:**
- MkDocs site setup using Bibliogon's `help/` as template
- Basic navigation analogous to content backbone (Sections A-G), but initially only:
  - A.1 "What is Phylax" (1 page, freshly written)
  - A.3 "First Steps" (step-by-step setup tutorial)
  - B "Daily Use" (5 pages, one per feature)
  - C.4 "Creating and restoring backups" (critical, large surface)
  - F "Background" (linking pages, no own content)
  - G.1 "FAQ" (5-10 entries to start)
- DE + EN parallel
- Linking to existing article series

**What stays out:**
- Full feature docs (B/C/D complete)
- In-app help link implementation (later step)
- Onboarding tour implementation (own feature)
- E "App Management" complete docs (can stay minimal, self-service)

**Effort estimate:** Initial setup ~1-2 days for Pandoc/MkDocs configuration plus 3-5 days content creation per language. With DE+EN parallel and existing sources from article series, realistic in 1-2 weeks part-time.

### 6.2 Iteration-2: In-App Integration

After Iteration-1 deployed and stable:

- "Help" icon in app header
- Context links in Settings sections
- First onboarding tour implementation (opt-in, skippable)

### 6.3 Iteration-3: Full Build-Out

After Iteration-2 stable:

- Fill remaining doc areas
- Integrate fifth article of the series when finished
- Expand FAQ based on real user questions
- Prepare trusted-person area for Phase 8

### 6.4 Iteration 0+: Immediate Steps

Before Iteration 1 starts, small steps could deliver value immediately:

- Extend README with reference to planned doc site (even if not live yet)
- Make existing article links visible in README or Settings section (already partially in README)
- 1-2 FAQ entries covering common questions (in README or as `docs/faq.md` in repo)

---

## 7. Phylax-Specific Considerations

### 7.1 Privacy-First Consistency

The doc site must not undermine its own privacy promise:
- No Google Analytics
- No tracking pixel
- No newsletter form
- Static site, no embedded trackers

GitHub Pages itself logs accesses, which is acceptable and transparent.

### 7.2 No Medical Advice

Phylax-ROADMAP explicitly lists "Medical advice, treatment recommendations, or interpretation of health data" as out-of-scope. The docs must hold this line:
- Docs show **how** to record data, not **which** data to record
- Examples in docs are generic, no "this is good diabetes tracking"
- Disclaimer on doc landing page analogous to Bibliogon style if relevant

### 7.3 Consistency with App Language

When the app says "Beobachtung", the docs say "Beobachtung", not "Eintrag" or "Notiz". The glossary (`docs/i18n-glossary.md` exists from I18N-02-prep) is the source of truth.

For EN docs: same discipline, glossary defines canonical English terms ("Observation", "Lab Value", "Supplement", "Open Point", etc.).

### 7.4 Version Awareness

Phylax v1.0.0 just landed, but features keep coming. Docs must clarify which version they describe:
- Footer with "As of: Phylax v1.0.x" or similar
- For larger version jumps, a version switcher (MkDocs supports this) or noted doc state per phase

---

## 8. Open Questions

To clarify before Iteration 1:

1. **Hosting domain:** `astrapi69.github.io/phylax-docs/` (separate repo) or subpath in Phylax repo (`astrapi69.github.io/phylax/docs/`)? Separate repo is cleaner for deploy cycles, but two repos to maintain. Bibliogon's `help/` lives inside the bibliogon repo, so the existing pattern is "subpath, single repo".

2. **~~Are the four articles publicly linkable?~~** ✅ Resolved: yes, public on Medium. Parts 1-2 in EN, full DE series. Parts 3-4 EN translation in progress.

3. **~~Bibliogon MkDocs config~~** ✅ Resolved: lives in Bibliogon's `help/` folder, reusable as template.

4. **Onboarding tour format:** Tour within the app (interactive with spotlight/highlight library) or simpler as a static setup guide in the onboarding flow? First is more powerful, second is faster to implement. Decision can defer to Iteration-2.

5. **Search engine visibility:** Should the doc site be indexable (Google finds it) or deliberately not? Phylax privacy ethos could speak for nofollow, but then the docs don't reach potential users. Lean: indexable. Privacy of users using the app is independent from discoverability of the docs.

6. **Contribution path:** Should external people be able to submit doc pull requests? If yes, a CONTRIBUTING.md and review workflow are needed. Lean: defer to Iteration-3 or beyond. Solo maintainer first, community contribution later.

---

## 9. Recommended Next Step

Not: start building immediately.

Instead:

1. **Review this exploration with user.** Are the assumptions right? Does the recommendation hold?
2. **Resolve remaining open questions from Section 8.** Especially Question 1 (hosting domain) and Question 4 (onboarding tour format — can defer).
3. **Decide Iteration-0+ immediate measures.** What should happen before MkDocs setup?
4. **Finalize Iteration-1 plan.** With clear content list, effort estimate, definition-of-done.
5. **Only then implement.**

---

## 10. Summary

Phylax needs user docs. The recommendation is a hybrid approach with:

- **MkDocs site** as canonical work, analogous to Bibliogon (`help/` template reusable)
- **In-app help links** for context access without bundle bloat
- **Opt-in onboarding tour** for first-time user guidance — offered, not forced
- **DE+EN parallel** matched to the app
- **Existing article series as theoretical anchor**, not as doc replacement (Parts 1-2 EN, full DE, Parts 3-4 EN in progress, Part 5 planned)
- **Iteration-based build-up** instead of big bang
- **Phase-triggered updates** instead of commit-triggered (anti-burnout discipline)

The first iteration is limited to MVP docs with MkDocs setup plus the most critical 5-7 content pages. Later iterations expand in-app integration and content.

Before implementation: clarify open questions and finalize Iteration-1 plan.
