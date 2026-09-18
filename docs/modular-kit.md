# Modular building kit

Decided 2026-09-17. A city stops generating a bespoke model per parcel. It repeats pieces from the authored families instead.

## Why

A 1288-parcel city generated 1288 unique shells: 95 GB, 13 minutes, and 1288 unique meshes for the renderer. Nothing was shared even when two parcels wanted the same building. Measured on one group of 61 parcels that are all offices, high_rich, on the identical 40x56 lot: 23 distinct floor counts, 27 distinct envelope heights, 10 door positions differing by float dust, all baked into the geometry. None of that describes a different building; it describes where a building stands.

## Shape

The authored families are the product: corporate-sectors, faceted-bays, white-grid, balcony-grid, mirror-shutters, mirror-frame, plus the rounded, octagon, cylinder, pyramid and setback shapes. A family is authored once as pieces and repeated, never regenerated per parcel.

Height repeats floors. Width and depth repeat bays. Atlas lot dimensions are all multiples of 8 m (16, 24, 32, 40, 56), so every lot is a whole number of 8 m bays: 2, 3, 5 or 7. Nothing is stretched or re-cut to fit.

Per family, six pieces:

- `corner`, `bay`, `entrance-bay`, each in three vertical bands: ground, middle, crown

A 56 m facade is two corners around five bays and one entrance bay. A 30 floor tower is a ground band, 28 middle bands and a crown. Six families is about 36 pieces for a whole city.

Variety comes from which family, how many bays, how many floors, tier materials, rotation, corner treatment, signage, ads and roof props. Not from unique geometry. The bay repeats, so the renderer draws it instanced.

## Per box

**atlas**: publishes the standard lot sizes (landed) and flags 10-30 landmark parcels per city. Envelope height and the access point must follow the lot and type, not the parcel, so identical lots ask for identical buildings.

**exterior**: authors each family as its six pieces instead of generating a whole building per parcel. A bay tiles seamlessly with itself and with its corners: matching planes, continuous facade pattern, aligned window bands. Signage is not baked; pieces publish sign anchors. Links carve per instance by swapping a bay, never by giving the parcel its own building. A family never loses its architecture to a geometry budget; budgets remove repeat noise, never form.

**interior**: one interior per band kind, reused by every instance.

**engine**: assembles a building as family, bays across, bays deep, floors, materials, and publishes the placement of each piece. Runtime draws pieces instanced and applies per-instance signs, ads and props.

**materials**: tier and style variants carry the difference between instances, and the patterns that replace removed geometry (blind slats, louvre blades, panel joints, fixing heads).

## Order

Done. Each was verified by the orchestrator's own measurement, not by the owning agent's report.

1. exterior, families at full strength under the geometry budget: the budget takes repeat noise and never form. Mean shell went from 74.9 MB and 979,560 triangles to 3.53 MB and 58,059, with every parcel keeping the family it chose.
2. atlas standard lot sizes: six sizes, every dimension a multiple of 8 m, all 1,589 ordinary parcels matching their declared size exactly, 22 landmarks.
3. engine, the building preview renders exactly as the game does, so quality is judgeable. On the WebGL2 fallback add `&quality=high`, since tier low has no bloom and no environment probe by design.
4. exterior, the pieces: six families, nine pieces each, 309 KiB of geometry for a whole city. A 56x40 m twenty floor tower is 480 placements of 9 distinct pieces.

Next, in this order.

5. engine adopts the pieces: assemble a building from its family, bay count and floor count, publish the placement table, draw the pieces instanced, letter signs per instance. Until this lands every city still comes from the per-parcel generator, so nothing on screen is built from the kit yet.
6. the families themselves get remade, judged against the preview.
7. interior, per band interiors.

## Notes

`engine/src/assembly/KitCatalog.js` groups whole identical buildings. Once buildings assemble from bays there is nothing to group, so its grouping goes and only its lot frame math survives.
