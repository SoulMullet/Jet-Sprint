// Shared by scenery, land clearance, and safety tests. No racing geometry here.
export const venueLayout=Object.freeze({
 cabin:{x:-70,z:-38,radius:13},
 dock:{x:-76,z:-14,radius:9},
 pickup:{x:-52,z:-43,radius:7},
 viewing:[{x:-27,z:-43,radius:9},{x:29,z:42,radius:9},{x:69,z:10,radius:9}],
});
export const sceneryClearings=[venueLayout.cabin,venueLayout.dock,venueLayout.pickup,...venueLayout.viewing];
export const inSceneryClearing=(x,z,padding=0)=>sceneryClearings.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+padding);
export function spectatorLocations(){
 return venueLayout.viewing.flatMap((group,g)=>Array.from({length:8},(_,i)=>({
  x:group.x+(i%4-1.5)*2.3,z:group.z+(Math.floor(i/4)-.5)*2.5,
  seated:i%3===0,phase:(g*8+i)*1.73,group:g
 })));
}
