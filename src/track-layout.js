// Original interpretation of Shelter View's compact island/channel geometry.
// Reference: https://www.v8jetsprints.co.nz/shelter-view-site-map
// Not a surveyed replica or a copied map. Coordinates are metres in game space.
// Edit these controls, junction fractions and branch controls to refine the venue.
export const outerSpline=[[-4,-52],[33,-48],[53,-26],[35,-3],[51,23],[31,49],[0,53],[-40,43],[-54,18],[-32,-3],[-49,-30],[-31,-50]];
export const junctionFractions={S:0,A:.2,D:.4,B:.65,C:.8};
export const centralJunction=[-2,1];
export const branchSplines=[
 ['A','J',[[29,-17],[17,-8]]],
 ['J','B',[[-18,12],[-34,18]]],
 ['C','J',[[-26,-19],[-13,-11]]],
 ['J','D',[[11,12],[23,25]]]
];
