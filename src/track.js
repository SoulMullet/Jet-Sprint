import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
const polygonCache=new WeakMap();
// Union capsule segments before triangulating. Offset ribbons fold over themselves
// when the inside radius is smaller than channel width, flipping lit normals.
function channelPolygons(points,width){
 let widths=polygonCache.get(points);if(!widths){widths=new Map();polygonCache.set(points,widths);}if(widths.has(width))return widths.get(width);
 const paths=points.paths||[points];
 const capsules=paths.flatMap(path=>path.slice(0,points.paths?-1:undefined).map((p,i)=>{
  const q=path[(i+1)%path.length],a=Math.atan2(q.z-p.z,q.x-p.x),ring=[];
  for(let j=0;j<=24;j++){const t=a-Math.PI/2+j*Math.PI/24;ring.push([q.x+width*Math.cos(t),q.z+width*Math.sin(t)]);}
  for(let j=0;j<=24;j++){const t=a+Math.PI/2+j*Math.PI/24;ring.push([p.x+width*Math.cos(t),p.z+width*Math.sin(t)]);}
  ring.push(ring[0]);return [ring];
 }));
 const result=polygonClipping.union(...capsules);widths.set(width,result);return result;
}
function geometryFromPolygons(polygons){
 const shapes=polygons.map(rings=>{
  const shape=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(([x,z])=>new THREE.Vector2(x,-z))));
  return shape;
 });
 const geometry=new THREE.ShapeGeometry(shapes);geometry.rotateX(-Math.PI/2);return geometry;
}
export function channelGeometry(points,width){return geometryFromPolygons(channelPolygons(points,width));}
export function channelBankGeometry(points,outer,inner){return geometryFromPolygons(polygonClipping.difference(channelPolygons(points,outer),channelPolygons(points,inner)));}
export function nearestOnTrack(points,x,z){
 let best=Infinity,px=0,pz=0,index=0,segmentId=null,along=0;
 const paths=points.paths||[points];
 for(const path of paths)for(let i=0,n=path.length-(points.paths?1:0);i<n;i++){
  const a=path[i],b=path[(i+1)%path.length],dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
  const qx=a.x+t*dx,qz=a.z+t*dz,d=(x-qx)**2+(z-qz)**2;
  if(d<best){best=d;px=qx;pz=qz;index=a.routeIndex??i;segmentId=path.id||null;along=t;}
 }
 return {x:px,z:pz,index,segmentId,t:along};
}

// Exact shared outlines remove grid-square shoreline artifacts and island seams.
export function channelTerrainGeometry(network,width){
 const bounds=[[[-125,-110],[125,-110],[125,110],[-125,110],[-125,-110]]];
 return geometryFromPolygons(polygonClipping.difference(bounds,channelPolygons(network,width)));
}
export function slopedBankGeometry(network,outer,inner){
 const flat=channelBankGeometry(network,outer,inner),split=new TessellateModifier(1.1,12).modify(flat),geometry=mergeVertices(split,1e-5);flat.dispose();split.dispose();const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const n=nearestOnTrack(network,p.getX(i),p.getZ(i)),d=Math.hypot(p.getX(i)-n.x,p.getZ(i)-n.z),t=Math.max(0,Math.min(1,(d-inner)/(outer-inner)));
  p.setY(i,-.08+.27*t*t*(3-2*t));
 }
 geometry.computeVertexNormals();return geometry;
}
