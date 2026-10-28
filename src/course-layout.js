// Original editable spline geometry inspired by Shelter View, Whanganui.
// Reference: https://www.v8jetsprints.co.nz/shelter-view-site-map
// The reference image, labels, logos and branding are not shipped with the game.
// Metres in the game's x/z plane. Channels are deliberately widened for drifting;
// tiny real-world sliver islands are omitted so the hull retains usable clearance.
export const layout={
 nodes:{S:[12,31],A:[-48,12],D:[-30,-34],B:[31,-23],C:[56,22],J:[-6,-2],W:[-57,-6],T:[2,-30],U:[10,-7]},
 edges:[
  {id:'S-A',from:'S',to:'A',via:[[0,40],[-25,40],[-43,31]]},
  {id:'A-D',from:'A',to:'D',via:[[-55,3],[-57,-6],[-57,-22],[-51,-34],[-42,-38]]},
  {id:'D-B',from:'D',to:'B',via:[[-17,-31],[-7,-33],[2,-30],[15,-34],[25,-34]]},
  {id:'B-C',from:'B',to:'C',via:[[39,-25],[53,-30],[61,-23],[62,-15],[58,-3],[57,10]]},
  {id:'C-S',from:'C',to:'S',via:[[55,36],[46,43],[31,39],[21,32]]},
  {id:'A-J',from:'A',to:'J',via:[[-35,17],[-25,19],[-19,12]]},
  {id:'J-B',from:'J',to:'B',via:[[3,-5],[10,-7],[19,-16]]},
  {id:'C-J',from:'C',to:'J',via:[[44,25],[32,15],[17,9],[2,10]]},
  {id:'J-D',from:'J',to:'D',via:[[-14,-9],[-29,-15],[-38,-25]]},
  // Optional connecting waterways subdivide the long western/northern islands.
  {id:'W-J',from:'W',to:'J',via:[[-43,-7],[-28,-5],[-17,-3]]},
  {id:'T-U',from:'T',to:'U',via:[[4,-22],[7,-13]]}
 ]
};
