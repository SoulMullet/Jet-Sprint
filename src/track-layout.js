// Original, hand-authored NZ-style venue. No external maps or downloaded data.
// Metres in world X/Z; each shared node is an actual connected water junction.
export const trackConfig=Object.freeze({
 id:'braided-meadows-v2',version:2,seed:24028,fluidSize:192,sampleSpacing:1.4,
 nodes:{S:[-48,-48],A:[0,-48],B:[8,-26],C:[-12,0],D:[12,34],E:[-69,-5]},
 edges:[
  {id:'S-A',from:'S',to:'A',via:[[-28,-50],[-12,-47]]},
  // East, west, then east hairpins, linked by flowing alternating bends.
  {id:'A-B',from:'A',to:'B',via:[[30,-50],[52,-47],[61,-36],[46,-24],[28,-28]]},
  {id:'B-C',from:'B',to:'C',via:[[-12,-22],[-38,-27],[-56,-19],[-57,-9],[-41,1],[-26,-3]]},
  {id:'C-D',from:'C',to:'D',via:[[9,6],[29,0],[47,6],[59,16],[58,25],[45,36],[28,37]]},
  {id:'D-E',from:'D',to:'E',via:[[-10,41],[-34,35],[-56,45],[-73,30],[-70,12]]},
  {id:'E-S',from:'E',to:'S',via:[[-77,-22],[-70,-43],[-61,-49]]},
  // Navigable cross-cuts form independent islands and junction choices.
  {id:'A-B-cut',from:'A',to:'B',via:[[-2,-39],[7,-35]]},
  {id:'B-C-cut',from:'B',to:'C',via:[[3,-15],[-6,-10]]},
  {id:'C-D-cut',from:'C',to:'D',via:[[-7,14],[4,25]]},
  {id:'C-E',from:'C',to:'E',via:[[-30,15],[-52,9]]}
 ],
 route:['S-A','A-B','B-C','C-D','D-E','E-S']
});
// Compatibility fixture for standalone loop geometry tests, not an active venue.
export const outerSpline=Object.values(trackConfig.nodes);
