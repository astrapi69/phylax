# ADR-0002: Defer extraction of crypto module

## Context

The crypto module (src/crypto/) is self-contained, fully tested, and has a stable API.
Consideration was given to extracting it into a separate npm package or Vite plugin
for reuse in future projects.

## Decision

Defer extraction. The module stays inside the Phylax repository until:

- A second project needs the same crypto semantics, or
- The API has proven stable through at least one full phase of Phylax development
  (i.e., after the repository and feature layers are built on top of it)

## Consequences

- No reuse cost now
- Extraction later is possible and inexpensive because the module is already
  architecturally isolated
- When extraction happens, it will be driven by real usage needs, not speculation
- Vite plugin is explicitly NOT the target format; a standard npm package would be
  the right abstraction if extraction becomes warranted
