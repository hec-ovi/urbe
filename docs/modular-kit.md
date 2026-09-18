# Modular building kit

A city repeats authored pieces from the families.

## Designs

Seven designs cover the city: corporate-sectors, faceted-bays, white-grid, balcony-grid, mirror-shutters, mirror-frame and garden-taper. The first six are registered families with piece sets. Garden-taper is a landmark design without a piece set.

Height repeats floors. Width and depth repeat 8 m bays. Atlas lot dimensions are all multiples of 8 m (16, 24, 32, 40, 56), so every ordinary lot is a whole number of bays. Nothing is stretched or re-cut to fit.

Per family, nine pieces:

- `corner`, `bay`, `entrance-bay`, each in three vertical bands: ground, middle, crown

A 56 m facade is two 4 m corner arms and six 8 m bays. A twenty-floor tower is a ground band, eighteen middle bands and a crown. Six families is 54 pieces for ordinary parcels.

Variety comes from which family, how many bays, how many floors, tier materials, rotation, corner treatment, signage, ads and roof props.

## Per box

**atlas**: publishes the six standard lot sizes, rectangular blocks and lots, and block templates keyed by size and zone. Envelope height and the access point follow the lot and type, so identical lots ask for identical buildings. Ten to thirty landmark parcels per city stay one of a kind. Default city 3000 x 3000 m.

**exterior**: authors each registered family as nine pieces. A bay tiles with itself and with its corners: matching planes, continuous facade pattern, aligned window bands. Pieces publish sign anchors. Links carve per instance by swapping a bay. A family never loses its architecture to a geometry budget; budgets remove repeat noise, never form. `npm run kit` writes the piece GLBs and `kit.json`.

**interior**: shared compressed room modules and three reusable layouts, ground, middle and crown, reused by every furnished instance.

**streets**: reusable 8 m units along each run, with fitted closures, junctions and original prop placements. No street piece is stretched.

**engine**: assembles an ordinary building as family, bays across, bays deep, floors and materials, and publishes the placement table. Runtime draws pieces instanced and applies per-instance signs, ads and props. Landmarks and parcels the kit cannot stand on keep a unique shell. Launcher sizes: Small 500 m, Medium 1000 m, Big 3000 m.

**materials**: tier and style variants carry the difference between instances, and the patterns that replace removed geometry (blind slats, louvre blades, panel joints, fixing heads).

## Landed

- Atlas standard lots, rectangular plans, block templates, default 3000 x 3000 m.
- Exterior nine pieces for each of the six registered families, kit CLI, `planAssembly` and recipes.
- Engine ordinary parcels as placement tables, instanced draw, cuboid colliders, cell streaming.
- Streets 8 m piece kit with fitted closures and junctions.
- Interior shared modules and the three band layouts.
