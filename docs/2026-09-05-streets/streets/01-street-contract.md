# 01. Street contract

Status: drafted.

## Purpose

Produce deterministic, complete street geometry and fitted ground regions consumed by downstream boxes.

## In

- seed and city bounds;
- street graph;
- family dimension profile;
- grade and elevation settings;
- sidewalk, curb, crossing, highway, and fixture policies.

## Out

- corridor geometry and identifiers;
- road, curb, sidewalk, crossing, and transition regions;
- highway and ramp envelopes when requested;
- walkable and drivable regions;
- validation results.

## Closed errors

- invalid-bounds
- invalid-profile
- disconnected-terminal
- incomplete-junction
- overlapping-region
- clearance-failure
- navigation-failure

## Invariants

- shared edges are emitted once and consumed by adjoining regions;
- road, curb, and sidewalk elevations agree;
- no accidental gaps or overlaps exist;
- output is deterministic for the same input;
- navigation follows the published geometry.

See the parent [street system guide](../GUIDE.md) and the existing [Atlas street contract](../../../atlas/src/streets/construction/CONTRACT.md).

