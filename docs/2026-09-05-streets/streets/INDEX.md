# Streets section resolver

This section owns the street guide's first implementation area. Read only the subsection that matches the task.

## Sections

- [01. Street contract](01-street-contract.md): inputs, outputs, errors, and invariants.
- [02. Straight corridors](02-straight-corridors.md): the first buildable road, curb, sidewalk, and navigation slice.
- [03. Junctions and intersections](03-junctions-and-intersections.md): shared domains, clean cuts, crossings, and infill.
- [04. Curves and diagonals](04-curves-and-diagonals.md): declared angles, continuous curvature, and fitted joins.
- [05. Sidewalks and curbs](05-sidewalks-and-curbs.md): ground layers, paving modules, transitions, and pedestrian clearance.
- [06. Highways and ramps](06-highways-and-ramps.md): complete elevated envelopes, supports, and grade connections.
- [07. Materials and lighting](07-materials-and-lighting.md): semantic regions, mapping, fixtures, and night readability.
- [08. Validation captures](08-validation-captures.md): reproducible tests, screenshots, and acceptance evidence.
- [09. Panels, alignment, and transition](09-panels-alignment-and-transition.md): sidewalk modules, zone material sets, parking cuts, one-sided streets, width hierarchy, avenues, curved intersections, corresponding curb and gutter spans, corner rules, ramps, and exact references.
- [section references](section_references/INDEX.md): exact copied screenshots supplied for this dated guide.

## Dependency edges

straight corridors -> junctions -> sidewalks and curbs -> curves and diagonals -> highways and ramps -> materials and lighting -> validation captures

Every subsection depends on the [street contract](01-street-contract.md). Reference images inform appearance and relationships; they do not replace the numeric geometry contract.

## Status

The subsection files are the next writing targets. The parent [GUIDE.md](../GUIDE.md) contains the complete initial instructions while each subsection is expanded.
