# Street system guide

Date: 2026-09-05  
Scope: Atlas street geometry, pedestrian ground, junctions, elevated routes, and visual presentation.

## 1. What this is

This is the working guide for making the generated city streets read as a constructed, walkable system. It translates the street requirements and supplied screenshots into implementation rules that can be checked from Atlas output.

The target is deterministic:

- the same parameters and seed produce the same street geometry;
- every road, curb, sidewalk, crossing, ramp, and support has an explicit owner;
- adjoining surfaces share boundaries and elevations;
- material regions fit the geometry they describe;
- paths remain usable for pedestrians, vehicles, and transit;
- changes to city size, block shape, or road angle do not require hand-authored patches.

This guide covers the street system first. Buildings, interiors, and gameplay consume the published street boundaries.

## 2. Read before changing code

Use the [dated resolver](INDEX.md) to select one section. Then read:

1. the relevant section in [streets/INDEX.md](streets/INDEX.md);
2. the public [Atlas street construction contract](../../atlas/src/streets/construction/CONTRACT.md);
3. the narrower contract for the box being changed;
4. the applicable screenshots in [section_references](streets/section_references/INDEX.md);
5. the existing annotated references in [inbox street references](../../inbox/references/end-state-2026-09-02/streets/INDEX.md).

Do not begin by editing a renderer mesh. First identify the source boundary, the owning geometry box, and the published data consumed downstream.

## 3. Target language

| Term | Meaning |
| --- | --- |
| corridor | Complete reserved width for one street family |
| carriageway | Drivable road surface inside a corridor |
| pedestrian reservation | Sidewalk and its required clear route |
| curb band | Constructed height change and edge between road and sidewalk |
| junction | Shared region where two or more corridors meet |
| transition | Fitted piece that closes a boundary between unlike regions |
| envelope | Full volume needed by a road, ramp, support, or transit structure |
| source boundary | Numeric edge from which geometry and mapping are derived |
| evidence capture | Reproducible screenshot with seed, parameters, camera, and renderer |

## 4. Street system contract

### 4.1 Inputs

The generator receives a city seed, city bounds and origin, street graph nodes and edges, a street family and dimension profile, grade and elevation settings, sidewalk and curb settings, and optional highway, ramp, transit, garden, lighting, and signage settings.

### 4.2 Outputs

It publishes complete corridors with centerline, width, grade, and family; road, curb, sidewalk, crossing, and transition boundaries; junction ownership; highway and ramp envelopes; walkable and drivable regions; stable identifiers for downstream boxes; and validation results or a closed named error.

### 4.3 Invariants

- no road or sidewalk ends in an accidental gap;
- no two surface owners overlap except at an explicit shared boundary;
- each curb has a consistent top elevation and vertical face;
- road and sidewalk joints use the same construction datum;
- crossing markings terminate inside their assigned region;
- curves and diagonals join with matching position and direction;
- supports and fixtures clear the usable route;
- generated geometry and navigation agree;
- dimensions remain valid when seed, block size, or street family changes;
- a failed construction is reported instead of silently omitted.

## 5. Shared arithmetic model

### 5.1 Coordinate discipline

Choose one world origin and one unit system for the entire street pass. Convert graph coordinates once at the boundary. Every child surface receives the same local frame, handedness, and elevation datum.

Record for each corridor:

- start and end points;
- tangent at both ends;
- plan length;
- road width;
- sidewalk width on each side;
- curb width and height;
- grade;
- family and seeded style;
- neighboring corridor identifiers.

### 5.2 Ownership before meshing

Construct in this order:

1. reserve the complete corridor envelope;
2. derive road edges from centerline and width;
3. derive curb bands from road edges and sidewalk elevations;
4. derive sidewalk fields from the curb boundary and pedestrian width;
5. derive crossings, planting strips, fixtures, and transitions from remaining owned regions;
6. emit render and navigation surfaces from the same polygons.

A visual seam is not a geometry contract. The geometry owner must be known before a material seam is assigned.

### 5.3 Shared construction datum

Road, curb, sidewalk, crossing, ramp, and support bases use one construction datum. Do not calculate each mesh from an independent approximation of the same line.

Where two surfaces meet, publish the shared edge once and let both surfaces consume it. Where a border has thickness, publish both edges and its vertical faces. Where a transition closes a corner, publish the actual polygon instead of stretching a rectangle across it.

## 6. Street families

### 6.1 Local street

Use for ordinary blocks and short connections. It needs a driveable carriageway, pedestrian reservations, curb bands, junction terminals, and a stable identifier and direction.

### 6.2 Broad avenue

Use a wider road profile with larger pedestrian reservations, crossings, lighting, and optional median or transit reservation. Derive every region from the same centerline and width table.

### 6.3 Alley and service route

Use a narrower family only where the reserved envelope still leaves a continuous usable route. Service fixtures, wires, ducts, and entrances consume reserved side space rather than narrowing the path after geometry is built.

### 6.4 Highway and elevated road

Treat the highway as a complete envelope, not a flat strip. Include carriageway, deck or grade, barriers, underside, supports, clearance, ramps, and pedestrian consequences below. Buildings and fixtures are placed after this volume is reserved.

## 7. Straight block slice, first implementation target

Create one straight street between two complete junctions.

1. Generate two terminal junction records.
2. Connect them with a straight centerline.
3. Apply one explicit dimension profile.
4. Derive both road edges and curb bands.
5. Derive sidewalks from curb outer edges.
6. Add a crossing only when the pedestrian graph requires it.
7. Emit render and navigation regions from the same polygons.
8. Run fit checks before adding materials or decoration.

The slice passes when close, overhead, and walking views show a continuous road, visible curb step, broad sidewalk, deliberate panel scale, no floating or overlapping surface, matching terminal coordinates, and stable output across three seeds.

## 8. Junctions, cuts, and intersections

### 8.1 Junction ownership

Compute one shared junction domain from incoming corridor envelopes. Assign road fields, curb and edge strips, sidewalk fields, crossings, transition pieces, service reservations, and fixture anchors inside that domain.

Each region ends at a deliberate boundary. A texture crop cannot decide where a street ends.

### 8.2 Clean cuts

For straight or angled approaches:

- clip each approach against the shared junction domain;
- construct the common road field once;
- fit sidewalks and curbs to the resulting perimeter;
- terminate markings inside their owner;
- avoid coplanar duplicate faces;
- verify that no narrow sliver remains between owners.

Use the annotated [intersection material notes](../../inbox/references/end-state-2026-09-02/streets/intersection-material-separation.md) and the copied screenshots in [section references](streets/section_references/INDEX.md).

### 8.3 Crossings

Crossings follow the pedestrian graph and actual approach width. Generate stripes or bands inside a bounded crossing region with consistent spacing, orientation, and margins. They must not continue through a curb, building corner, or unrelated road field.

## 9. Curves and diagonals

### 9.1 Curves

A curve is a path with a defined radius or curvature profile. Derive both edges, curb, sidewalk, transition pieces, and material coordinates from the same path.

At every join, compare position and tangent. Reject a join with a kink, width change, overlap, gap, or abrupt material reset.

Use the existing [smooth highway curve reference](../../inbox/references/end-state-2026-09-02/streets/smooth-highway-curves.md) for the expected relationship between path, edge band, underside, and repeated elements.

### 9.2 Diagonals

A diagonal street uses a declared angle and compatible junction type. Its neighboring approach must use the same allowed angle set when the layout requires clean repeated construction. Do not mix arbitrary angles inside one intersection family.

All diagonal cuts still use shared boundaries. A diagonal is not permission to crop a rectangular sidewalk or rotate a texture until a gap is hidden.

## 10. Sidewalks, curbs, and ground transitions

### 10.1 Curb construction

The curb is geometry with a top, a vertical face, and two fitted boundaries. Its height is the difference between road datum and sidewalk datum. Keep that step visible at street level.

Use the [curb and sidewalk reference](../../inbox/references/end-state-2026-09-02/streets/curb-height-and-sidewalk-grid.md) for the relationship between road, curb, sidewalk, joints, and transition pieces.

### 10.2 Large paving modules

Use broad paving modules with a measured world scale. Joints are subordinate to the slab field. A repeated small tile pattern fails even when mapped to one large mesh.

Panel origins, joint widths, and terminal cuts derive from the sidewalk boundary. A final panel may be a fitted remainder, but it must be deliberate and consistent with neighbors.

### 10.3 Transitions and planting

Planting strips, ramps, service covers, and crossing infill are reserved regions. They cannot consume the clear pedestrian route or leave a triangular hole at a corner. Derive their borders from the sidewalk field and preserve the curb step.

## 11. Elevated routes and ramps

### 11.1 Highway envelope

Reserve the full highway volume before buildings, lights, wires, or signs. Check vehicle clearance, deck thickness, underside clearance, support footprint, sidewalk continuity, building openings, and ramp connection space.

See [elevated highway structure](../../inbox/references/end-state-2026-09-02/streets/elevated-highway-structure.md) and [building highway passages](../../inbox/references/end-state-2026-09-02/streets/building-highway-passages.md).

### 11.2 Ramps

A ramp joins two known elevations and directions. Define the available run before choosing its grade. Derive side bands, barriers, supports, pedestrian crossings, and mapping from the same path.

The ramp must connect to actual road surfaces and remain consistent with collision and navigation data. A decorative ramp without a usable route is incomplete.

## 12. Materials and presentation

### 12.1 Material regions

Keep road, curb, sidewalk, crossing, border strip, planting, and metal fixtures as separate semantic regions. Materials supply the finish, while Atlas supplies the fitted region and stable role.

Use neutral dark surfaces with restrained local reflections. Variation changes roughness, wear, or controlled patterning. It must not change geometry, boundary ownership, or palette.

### 12.2 Mapping

Map from world dimensions or construction distance. Check the start and end of every repeated pattern. Reject stretched, arbitrarily cropped, or restarted textures at a shared boundary.

Use [street materials and reflections](../../inbox/references/end-state-2026-09-02/streets/street-materials-and-reflections.md) for the expected distinction between broad surface regions, local highlights, road wear, and fitted markings.

### 12.3 Lights and signals

Place lights and traffic signals from road and crossing anchors. Orient each luminous face toward its users and keep posts, arms, and supports outside usable paths.

Lighting should reveal the road edge, curb step, surface roughness, and crossing without making the full scene uniformly bright. See [street lights](../../inbox/references/end-state-2026-09-02/streets/futuristic-street-lights.md) and [overhead signals](../../inbox/references/end-state-2026-09-02/streets/overhead-digital-signs-and-traffic-lights.md).

## 13. Validation and evidence

### Geometry checks

Run checks at the public street entry point:

- every corridor has complete endpoints;
- every junction has one shared domain;
- adjacent surfaces have matching shared edges;
- no owned region overlaps another without an explicit boundary;
- no unexpected hole or sliver exists;
- road and sidewalk elevations produce the declared curb height;
- walkable and drivable regions are nonempty and connected where required;
- highway supports and fixtures clear the active route;
- changed seeds and dimensions preserve all invariants.

### Render checks

Capture each representative case with seed and parameter export, renderer and quality, camera pose, view type, source geometry identifiers, screenshot filename, and linked guide subsection.

Capture neutral diagnostic lighting as well as intended night lighting when checking materials. Do not diagnose a base color from a single dark or bloom-heavy frame.

### Evidence states

- unreviewed: copied source exists;
- mapped: screenshot is linked to a subsection;
- reproduced: current output captured under matching conditions;
- accepted: relevant contract check passes;
- blocked: a named missing input or failing contract prevents comparison.

## 14. Screenshot handling

The guide owns exact copies of the supplied files in [streets/section_references](streets/section_references/). Keep filenames unchanged. Add interpretations beside them in Markdown; do not rename or overwrite the source captures.

The first working gallery:

![Street reference 01](<streets/section_references/Screenshot From 2026-09-05 04-51-54.png>)

![Street reference 02](<streets/section_references/Screenshot From 2026-09-05 04-52-16.png>)

![Street reference 03](<streets/section_references/Screenshot From 2026-09-05 04-52-36.png>)

Use the [reference index](streets/section_references/INDEX.md) to reach the other copied files without loading the full image set into every task.

## 15. Implementation order

1. Measure and publish the straight corridor profile.
2. Make one straight block pass geometry and navigation checks.
3. Build the shared junction domain and fitted intersection pieces.
4. Add sidewalk and curb module fitting.
5. Add curves and declared diagonal families.
6. Add highway envelopes and ramps.
7. Fit materials, markings, lights, and signals.
8. Rebuild a small city with several street families.
9. Capture comparable evidence and update section states.
10. Move to buildings only after street boundaries and routes are accepted.

## 16. Open measurements

Select these values from project profiles and generated output, not screenshot guesses:

- road widths by street family;
- sidewalk widths by district or family;
- curb height and width;
- panel and joint dimensions;
- curve radii and allowed diagonal angles;
- crossing width and stripe spacing;
- highway deck height, thickness, and support spacing;
- ramp grade and transition length;
- minimum pedestrian and vehicle clearances.

Until these are selected, the guide defines the construction method and acceptance criteria, not a final numeric style sheet.

