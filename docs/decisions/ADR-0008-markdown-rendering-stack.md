# ADR-0008: Markdown Rendering Stack

## Context

Phylax stores significant portions of profile content as Markdown: observations have Markdown-formatted fact/pattern/self-regulation fields, BaseData carries a free-form `contextNotes` Markdown field, timeline entries have Markdown bodies, and the import format is a Markdown document in the "Lebende Gesundheit" convention. Starting with the V-01 read-only profile overview, the UI needs to render these fields visually rather than showing raw Markdown source.

Two requirements drove the decision:

1. **Safety.** Imported profiles can contain arbitrary content. Rendering raw HTML from an imported document would create an XSS path that defeats the local-first encrypted-storage threat model. Any renderer we adopt must default to treating HTML as text.
2. **Consistency.** Markdown is rendered in multiple places across the app. Hand-rolling per-site styles, or writing our own Markdown parser, would silently diverge across components and invite regressions.

Phylax's locked dependency list (coding-standards.md) otherwise forbids adding runtime dependencies without an ADR, so this decision is recorded here.

## Decision

Adopt two new dependencies and wrap them in a single reusable component:

- `react-markdown` (^9, runtime dependency): the de facto standard React Markdown renderer. Uses the remark/rehype pipeline. Defaults to sanitizing output: raw HTML in the source is rendered as text, not parsed as tags. We explicitly do NOT enable `rehype-raw`.
- `@tailwindcss/typography` (^0.5, dev dependency): provides the `prose` utility class family. Generates CSS at build time; zero runtime weight beyond the classes actually used.
- A single internal wrapper `src/features/profile-view/MarkdownContent.tsx` combines them. Every Markdown-rendered region in the app imports this component. No other call site touches `react-markdown` directly.

The wrapper treats empty or whitespace-only input as "render nothing" so call sites do not need conditional guards.

## Consequences

### Positive

- XSS attack surface from imported profile content is limited to react-markdown's sanitization, which is well-maintained and widely audited.
- One place to adjust Markdown styling for the whole app. Changes to `prose` classes or renderer options propagate automatically.
- Build-time CSS generation via the typography plugin means the bundle only ships styles for classes actually used in components.

### Negative / trade-offs

- Bundle cost: react-markdown and its micromark/remark/rehype dependency tree add approximately 50 KB gzipped to the production bundle. Within the 250 KB gzipped budget from `quality-checks.md`.
- Two new packages in the dependency graph means two more packages to monitor for advisories. Both are actively maintained; react-markdown is at major version 9 with a large ecosystem, and the typography plugin is maintained by the Tailwind team.
- `@tailwindcss/typography` pulls in its own opinionated defaults. We accept these as the house style and only override at call sites that need it.

### Rejected alternatives

- **Hand-rolled renderer.** Writing a minimal Markdown-to-JSX converter for our subset looked attractive but failed on the safety requirement: blocking HTML injection correctly across nested patterns requires the same work the existing libraries already do.
- **`marked` + `dompurify`.** Works, but introduces two dependencies instead of one, and marked's output requires additional JSX wrapping. No net benefit over react-markdown.
- **Skip Tailwind typography, hand-style element rules.** Considered. Would work but silently diverges across call sites the moment anyone forgets to apply the styles. The plugin costs nothing at runtime, so this was cheaper.

## Notes

If a future task needs to render HTML inside Markdown (for example, embedding sanitized SVGs from imports), it must go through an explicit `rehype-raw` + `rehype-sanitize` configuration reviewed in a new ADR. Default stays safe.
