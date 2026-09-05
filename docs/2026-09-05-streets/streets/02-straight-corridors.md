# 02. Straight corridors

Status: first implementation slice.

## Build

Create one straight corridor between two complete terminals. Derive road edges, curb bands, sidewalks, and navigation surfaces from one centerline and one dimension profile.

## Check

- endpoints match terminal junctions;
- road width is constant;
- sidewalk width is constant unless the profile declares a change;
- curb top and vertical face are present;
- no region floats, overlaps, or leaves a sliver;
- walking and driving routes use the same boundaries as the render.

## Evidence

Use overhead, street-level, and close curb captures. Link the current copied screenshot in [section references](section_references/INDEX.md) after its relationship is annotated.

Related: [GUIDE.md](../GUIDE.md#7-straight-block-slice-first-implementation-target).

