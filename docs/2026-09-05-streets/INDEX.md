# Streets guide, 2026-09-05

This dated guide records the street-generation target, implementation instructions, and visual evidence for the next Atlas quality pass.

## Resolver

Read this file first. Open only the section that matches the work in front of you, then inspect its linked contracts and screenshots.

| Need | Open | Contains |
| --- | --- | --- |
| Understand the target | [GUIDE.md](GUIDE.md) | Scope, rules, geometry model, implementation order, and acceptance checks |
| Work on street construction | [streets/INDEX.md](streets/INDEX.md) | Resolver for roads, sidewalks, junctions, curves, highways, and presentation |
| Inspect supplied screenshots | [streets/section_references/INDEX.md](streets/section_references/INDEX.md) | Exact copied source files and working reference slots |
| Check the existing box boundary | [Atlas street contract](../../atlas/src/streets/construction/CONTRACT.md) | Current public contract for road profiles and pedestrian reservations |
| Check the city boundary | [Atlas box map](../../atlas/docs/INDEX.md) | Atlas responsibilities and its internal street boxes |
| Review broader visual context | [Existing street reference index](../../inbox/references/end-state-2026-09-02/streets/INDEX.md) | Earlier annotated references and observations |

## Working model

- One guide section owns one street responsibility.
- Geometry is derived from shared dimensions, boundaries, and seeded choices.
- A screenshot is evidence of an intended relationship, not a source of arbitrary pixel measurements.
- New findings belong in the smallest matching section and in the reference index.
- When implementation begins, update the relevant box contract and this resolver in the same change.
- Keep this guide focused on current decisions.

## Current coverage

- [x] Dated guide created.
- [x] Exact screenshot references copied.
- [x] Street system scope and invariants written.
- [x] Straight roads, sidewalks, curbs, junctions, curves, and highways outlined.
- [ ] Numerical dimensions selected from measured Atlas output.
- [ ] Section evidence annotated against individual screenshots.
- [ ] Implementation changes linked to passing tests and captured renders.

Start with [GUIDE.md](GUIDE.md), then use [streets/INDEX.md](streets/INDEX.md) to enter a focused subsection.

