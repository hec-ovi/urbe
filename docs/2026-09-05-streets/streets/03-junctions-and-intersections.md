# 03. Junctions and intersections

Status: drafted.

## Build

Compute one shared junction domain from all incoming corridor envelopes. Assign road, curb, sidewalk, crossing, and infill ownership inside that domain.

## Check

- every approach terminates on the shared domain;
- road fields meet without gaps or duplicate coplanar faces;
- curbs and sidewalks follow the resulting perimeter;
- crossings follow the pedestrian graph;
- markings stop inside their owner;
- no triangular or narrow leftover region remains.

Use the annotated [intersection reference](../../../inbox/references/end-state-2026-09-02/streets/intersection-material-separation.md) and copied captures in [section references](section_references/INDEX.md).

Related: [GUIDE.md](../GUIDE.md#8-junctions-cuts-and-intersections).

