import { BoxGeometry } from "three";

/** One width/pose definition feeds the deck, approach lift and launch gate. */
export function arcadeRamp(world, distance, coverage, id) {
  const p = world.river.sample(distance),
    contact = world.nearest(p.x, p.z),
    usableWidth =
      2 *
      (contact.hullLimit ?? contact.waterWidth - world.collisionNearest.radius);
  return {
    id,
    distance,
    coverage,
    usableWidth,
    halfWidth: (usableWidth * coverage) / 2,
    offset: 0,
    side: 1,
    launch: 7.2,
    minSpeed: 9,
    bonus: 0,
    deckLength: 8,
    deckRise: 0.55,
  };
}

/** Local +X is travel, Z spans the river. A submerged nose has no vertical lip. */
export function arcadeRampGeometry(jump) {
  const g = new BoxGeometry(jump.deckLength, 0.08, jump.halfWidth * 2),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) + jump.deckLength / 2) / jump.deckLength;
    p.setXYZ(
      i,
      p.getX(i) - jump.deckLength / 2,
      t * jump.deckRise + (p.getY(i) > 0 ? 0 : -0.08),
      p.getZ(i),
    );
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
