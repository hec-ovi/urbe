# Modular building kit

Decided 2026-09-17. A city stops generating one bespoke model per parcel and places a small catalog of reusable kits instead.

## Why

A 1288-parcel city generated 1288 unique shells: 95 GB, 13 minutes of generation, and 1288 unique meshes for the renderer. The same city built from a catalog is one model set placed many times: it fits in under a gigabyte, generates in seconds, and draws instanced.

## Shape

A **kit** covers one (building type, wealth tier, lot size, style variant) and holds three stackable pieces:

- `base`: ground floor, entrance, street frontage
- `middle`: exactly one floor, tileable vertically any number of times
- `crown`: top floor and roof, including roof access and equipment

Any floor count comes from one kit: base, N middles, crown. Around 60-80 kits per city, each placed 15-20 times.

Variety per instance, never per model: rotation, mirroring, tier colors and material variants, signage, ads, roof props.

## Per box

**atlas**: publishes a standard lot size set and subdivides blocks so every ordinary parcel takes one of those sizes exactly. Leftover land stays open. Flags 10-30 landmark parcels per city (hospital, police, singular corpo towers) that keep their own footprint.

**exterior**: generates a kit per key instead of a building per parcel. Same seed and key, same kit. The middle piece tiles seamlessly: matching floor planes, continuous facade pattern, aligned window bands. Signage is not baked; the kit publishes sign anchors and the instance carries the text. Landmark parcels still take a bespoke building through the existing entry.

**interior**: one interior per kit floor kind (base, middle, crown), reused by every instance, instead of one interior per building.

**engine**: assembly groups parcels by kit key, requests each kit once, and publishes a placement table (parcel, kit, floor count, rotation, mirror) in the manifest. Runtime stacks middles per instance, draws placements instanced, and applies per-instance signs, ads and props.

**materials**: tier and style variants carry the visual difference between instances of one kit.

## Order

1. exterior geometry weight (in progress): welding, shared frame profiles, blinds as material, triangle budget
2. atlas standard lot sizes and landmark flags
3. exterior kit pieces and sign anchors
4. engine assembly catalog, placements and instanced runtime
5. interior per-kit interiors
