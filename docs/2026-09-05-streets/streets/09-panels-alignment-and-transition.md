# 09. Panels, alignment, and street-to-sidewalk transition

Status: captured from the 2026-09-05 street references.

## Requirement

Model the ground as one aligned construction set:

sidewalk panel -> curb -> gutter -> street

The street edge is calculated from the same geometry that creates the sidewalk, curb, and gutter. These are not independent strips placed beside one another after the street has been made.

## Corner geometry

Use the corner type declared by the street layout:

- rounded corners use a continuous radius and fitted curved panels;
- angular corners use deliberate planar cuts with a declared angle;
- acute V-shaped cuts are unsupported and must not be generated;
- no corner may leave a sharp V point, triangular spike, gap, overlap, or abrupt material break;
- the curb, gutter, sidewalk panels, crossing, and road edge follow the same corner boundary.

An angle cut is a complete geometric decision. It is not a rectangular panel cropped until the remaining shape looks like a V. A rounded corner is likewise derived from the actual curve, not approximated by unrelated short pieces.

## Panel set

### Base module

The ordinary sidewalk module is approximately 1 m by 1 m. The exact value remains a profile setting, but the visible scale must stay close to a human construction module and must not become a small decorative tile grid.

Each sidewalk module has a corresponding curb and gutter alignment. The curb and sidewalk panel lengths can differ when the generated grouping declares that relationship, but their shared endpoints must remain explicit and aligned.

The intended vertical arrangement is:

1. sidewalk surface;
2. curb top and curb face;
3. gutter strip and its raised edge;
4. street surface.

The sidewalk is approximately 20 cm above the street at the curb. This height is the construction target, not a texture effect. The curb must have a visible top, a vertical face, and clean contact with the sidewalk and gutter.

### Curb module

A normal curb segment is approximately 1 m long and approximately 20 cm high, with depth selected by the construction profile. Its endpoints align with the sidewalk module or with the declared grouped span.

The curb is allowed to group across multiple sidewalk panels. For two 1 m sidewalk panels, a 2 m curb is valid when the curb's endpoints and material mapping are derived from the same 2 m span. Do not create two unrelated 1 m curbs when the selected style calls for one continuous 2 m curb.

### Gutter module

The gutter is the strip between curb and street. It is approximately 30 cm wide across the transition and has a small raised or defined edge, approximately 2 cm where the selected profile requires it. Its longitudinal span follows the associated curb group.

The gutter is part of the modelled transition, not a dark line between materials. It needs:

- a road-side boundary;
- a curb-side boundary;
- a visible edge or lip where the profile declares one;
- a stable elevation;
- fitted terminal geometry at corners, ramps, crossings, and street ends.

The usual one-panel set is therefore approximately:

sidewalk 1 m x 1 m -> curb 1 m long and 20 cm high -> gutter 1 m long and approximately 30 cm wide -> street

Values remain parameters. The relationship and alignment are required.

## Grouping and variety

Use deterministic grouping to avoid a city made of one repeated visual rhythm. A street may contain:

- one sidewalk panel with one curb and one gutter;
- two 1 m sidewalk panels sharing one 2 m curb and one 2 m gutter;
- longer repeated spans with a declared group length;
- rounded corner sets;
- angular corner sets;
- curb-ramp sets;
- avenue separators with a narrow central walking strip.

Grouping changes the ownership span and mapping scale together. It must not move a curb, stretch a gutter, or create a material restart at an arbitrary point.

## Zone styles and material sets

Commercial, residential, corporation, and industrial zones may select different panel, curb, and gutter styles. The material set can change the surface response, color range, wear, markings, plastic or concrete finish, and local detail.

The modeling contract stays the same:

- the sidewalk, curb, gutter, and street remain the same ordered construction set;
- shared boundaries, elevations, module stations, and collision follow the common arithmetic model;
- style selection is a seeded profile, not a separate hand-built mesh;
- a material variation cannot hide a missing curb face, gutter edge, gap, overlap, or bad cut;
- style changes are sparse and deliberate rather than applied at every module.

This separation allows automation. The generator can choose a zone style without creating a new geometry algorithm for every district. The same alignment and validation checks run for all material sets.

The references at 04:57:12, 04:57:35, and 04:57:42 show material and finish variation while preserving the panel, curb, and gutter relationship.

## Parking cuts

Some streets reserve parking spaces at selected locations. Parking is a calculated cut in the sidewalk field, not a rectangle placed over the panels.

### Parking module

Use a parking module with a declared vehicle envelope and station length. A typical slot occupies approximately 3 m to 4 m along the street. The construction grid remains 1 m, so a normal four-meter slot uses four complete panel stations.

For a street with 50 one-meter panel stations, a parking group may reserve an integer station range such as 30 through 40. The selected number of slots determines the exact occupied span. Two slots, three slots, and longer groups all start and end on panel stations so the remaining sidewalk panels preserve symmetry and alignment.

The cut must:

- begin and end on the shared sidewalk grid;
- use the declared parking width and vehicle clearance;
- fit its curb, gutter, road edge, and surface material to the same cut;
- use correct angular or rounded terminal geometry;
- preserve pedestrian routes around the reserved bay;
- publish its station range and slot count;
- remain deterministic for the same seed and parameters.

The cut may remove one-meter sidewalk blocks, including a curved terminal block where the style requires it. Do not stretch or rotate the neighboring panels to fill a remainder. The parking surface and its signal texture are separate style roles inside the calculated opening.

The 04:57:54 reference shows the parking cut and the one-meter block relationship.

## Small one-sided streets

Connections and alleys may have one pedestrian side only. Their street family declares the narrower width, one-sided pedestrian reservation, curb, gutter, and material style.

Do not force a two-sided avenue profile into a one-sided route. The modeling sequence remains the same, but the profile owns the missing side explicitly. The street, curb, gutter, sidewalk edge, and navigation boundary must still fit without a gap or an invented narrow strip.

The 04:58:15 reference shows the changed width and one-sided arrangement.

## Complex and diagonal corners

Complex or diagonal corners keep the panel module size. Do not scale a panel down merely because the boundary is difficult.

Use the established grouping rule shown in the 04:58:40, 04:58:48, and 04:58:54 references: two sidewalk panels can share one curb and one gutter group. The terminal geometry is calculated from the corner path while the panel size and group ownership remain explicit.

For rounded corners, use the continuous corner path and fitted panel terminals shown in the 04:59:01 reference. The rounded case still has a defined curb and gutter relationship; it is not a collection of arbitrary wedges.

## Gutter and curb variants

Add gutter and curb variants as style profiles. They may vary in surface material, edge treatment, wear, or grouping length while preserving the same construction order and alignment rules.

Variant selection is not frequent noise. Select it from the zone style and a sparse seeded variation rule. A long street should read as one constructed street with occasional deliberate changes, not as a new curb recipe at every panel.

The 04:59:08 reference records this type of occasional curb and gutter variation.

## Ramps with signals

The curb-ramp style may include richer surface treatment, directional signals, and LED-like cycling letters or markings. These are fitted contents inside the ramp's owned surface and do not replace the ramp, gutter, or curb geometry.

Fit letters and signals to the ramp's actual width and direction. Keep their spacing, aspect ratio, and illumination controlled by the style profile. They must end inside the ramp region and remain readable without crossing the curb or sidewalk boundary.

The 04:59:15 reference records a ramp with signals and more complex texturing.

## Smooth panel-free ground styles

Some zone styles use a smooth plastic-like surface between streets. This is a valid material and surface-mapping variant when selected by the zone profile. It may use a fitted tiling texture instead of visible sidewalk panel joints.

The common modeling remains present:

- curb and gutter still separate the sidewalk-level surface from the street;
- the transition still has its defined height and edge;
- the surface remains fitted to the same owned region;
- collision, navigation, and boundaries remain unchanged;
- the tiling scale is derived from the region dimensions;
- the style does not introduce gaps or cover a bad alignment.

This is a panel-free finish, not permission to remove the curb and gutter. The 04:59:23 reference records the smooth surface, continued curb, and continued gutter relationship.

## Curb ramps

Some street sections use curb ramps. A ramp is a fitted transition over the gutter, not a replacement for the gutter geometry.

Generate the ramp from the sidewalk elevation, street elevation, ramp width, and approach direction. Preserve the gutter below or beside the smaller ramp portion shown in the reference. The ramp may be clean or may carry a restrained signal pattern, selected deterministically by style.

Check that the ramp:

- reaches the sidewalk height without an unintended step;
- crosses the gutter without hiding its ownership;
- keeps the required pedestrian width;
- has no sharp V cut at either side;
- meets the road and sidewalk with matching boundaries;
- agrees with collision and navigation.

## Alignment rules

### Longitudinal alignment

For a straight run, the endpoints of the sidewalk group, curb group, gutter group, and street region share the same station coordinates. A two-panel group has two 1 m sidewalk spans and one aligned 2 m curb and gutter span when that style is selected.

### Transverse alignment

Across the street edge, use one ordered set of parallel boundaries:

sidewalk outer edge -> sidewalk inner edge -> curb top -> curb street face -> gutter outer edge -> gutter street edge -> road

The 20 cm sidewalk elevation and approximately 2 cm gutter edge are derived from the same construction datum. Do not compensate for a misplaced boundary with a dark decal or a floating mesh.

### Corner alignment

At a rounded or angular corner, all boundaries are generated from the same transformed corner path. Panel terminal cuts, curb segments, gutter edges, crossing fields, and road markings stop at their assigned ownership boundaries.

Inspect the corner from overhead and at walking height. A clean top view is insufficient if the curb face, gutter edge, or elevation transition floats in the street-level view.

## Reference mapping

The following screenshots are the exact copied files in [section_references](section_references/INDEX.md).

| Reference | Relationship recorded |
| --- | --- |
| [04:51:54](<section_references/Screenshot From 2026-09-05 04-51-54.png>) | One sidewalk panel with its curb and gutter |
| [04:52:16](<section_references/Screenshot From 2026-09-05 04-52-16.png>) | Sidewalk panels, curb, and a curb ramp over the gutter |
| [04:52:36](<section_references/Screenshot From 2026-09-05 04-52-36.png>) | Rounded corner set without ramps |
| [04:53:41](<section_references/Screenshot From 2026-09-05 04-53-41.png>) | Another rounded set with panels, curbs, and gutters |
| [04:54:12](<section_references/Screenshot From 2026-09-05 04-54-12.png>) | Grouped panel and curb variety |
| [04:54:26](<section_references/Screenshot From 2026-09-05 04-54-26.png>) | Higher view of grouped spans and their alignment |
| [04:55:16](<section_references/Screenshot From 2026-09-05 04-55-16.png>) | Avenue arrangement with an approximately 2 m narrow central walking strip |
| [04:56:18](<section_references/Screenshot From 2026-09-05 04-56-18.png>) | Two 1 m panels with a 2 m curb and aligned gutter |
| [04:57:12](<section_references/Screenshot From 2026-09-05 04-57-12.png>) | Zone-dependent finish variation with the same panel, curb, and gutter modeling |
| [04:57:35](<section_references/Screenshot From 2026-09-05 04-57-35.png>) | A second zone material set using the shared construction relationship |
| [04:57:42](<section_references/Screenshot From 2026-09-05 04-57-42.png>) | Another material and surface variation under the common alignment model |
| [04:57:54](<section_references/Screenshot From 2026-09-05 04-57-54.png>) | Arithmetic parking cut across one-meter sidewalk stations |
| [04:58:08](<section_references/Screenshot From 2026-09-05 04-58-08.png>) | Corner variation for a different style profile |
| [04:58:15](<section_references/Screenshot From 2026-09-05 04-58-15.png>) | Narrow one-sided connection or alley street |
| [04:58:40](<section_references/Screenshot From 2026-09-05 04-58-40.png>) | Complex or diagonal corner retaining panel sizing and grouped curb |
| [04:58:48](<section_references/Screenshot From 2026-09-05 04-58-48.png>) | Second complex corner with two-panel and one-curb alignment |
| [04:58:54](<section_references/Screenshot From 2026-09-05 04-58-54.png>) | Third complex corner variant with the same module rule |
| [04:59:01](<section_references/Screenshot From 2026-09-05 04-59-01.png>) | Rounded corner with fitted panel terminals |
| [04:59:08](<section_references/Screenshot From 2026-09-05 04-59-08.png>) | Occasional curb and gutter style variation |
| [04:59:15](<section_references/Screenshot From 2026-09-05 04-59-15.png>) | Ramp with signal treatment and fitted LED-like markings |
| [04:59:23](<section_references/Screenshot From 2026-09-05 04-59-23.png>) | Smooth plastic-like panel-free finish retaining curb and gutter |

The request first names a 04:64:12 image. No copied file has that name; the later 04:54:12 reference is the available matching capture and is used here.

## Implementation contract

Inputs are the street boundary, corner path, sidewalk profile, curb profile, gutter profile, selected grouping, and seeded style. Outputs are fitted sidewalk panels, curb top and face, gutter strip and edge, terminal cuts, and walkable surface metadata.

The implementation must:

- derive all four regions from shared boundaries;
- expose the chosen group length and profile values;
- support straight, rounded, and angular corner variants;
- reject unsupported acute V corners;
- preserve a 20 cm sidewalk height when selected by the profile;
- keep curb and gutter spans aligned with their panel group;
- select zone materials independently from the shared modeling algorithm;
- support sparse seeded style variation for commercial, residential, corporation, and industrial zones;
- fit parking cuts to integer one-meter panel stations and publish their slot count;
- support one-sided street profiles for alleys and connections;
- preserve panel sizing and grouped curb spans at complex and diagonal corners;
- support panel-free tiled finishes while retaining curb and gutter geometry;
- fit ramps over the gutter when selected;
- produce the same result for the same seed and parameters;
- report a named fit or clearance error instead of silently patching the result.

## Acceptance evidence

For each style, capture:

1. a straight one-panel set;
2. a two-panel grouped set;
3. a rounded corner without a ramp;
4. a rounded corner with a ramp;
5. an angular corner;
6. an avenue with the narrow central walking strip;
7. an overhead alignment view;
8. a street-level curb and gutter view.

Every capture records seed, exported parameters, camera, renderer, and the selected profile. Reject the result if any view shows a V-shaped corner, an unaligned joint, a missing curb face, a missing gutter edge, a 20 cm height mismatch, a floating transition, or a navigation boundary different from the visible geometry.
