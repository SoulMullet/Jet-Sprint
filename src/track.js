import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
// Union capsule segments before triangulating. Offset ribbons fold over themselves
// when the inside radius is smaller than channel width, flipping lit normals.
const polygonCache=new WeakMap();
export function channelPolygons(points,width){
 let cache=polygonCache.get(points);if(!cache){cache=new Map();polygonCache.set(points,cache);}if(cache.has(width))return cache.get(width);
 const paths=points.paths||[points];
 const capsules=paths.flatMap(path=>path.slice(0,points.paths?-1:undefined).map((p,i)=>{
  const q=path[(i+1)%path.length],a=Math.atan2(q.z-p.z,q.x-p.x),ring=[];
  // Sub-millimetre snapping removes near-coincident sweep-line intersections
  // across JS engines without changing the visible or collidable shoreline.
  const snap=x=>Math.round(x*10000)/10000;
  for(let j=0;j<=16;j++){const t=a-Math.PI/2+j*Math.PI/16;ring.push([snap(q.x+width*Math.cos(t)),snap(q.z+width*Math.sin(t))]);}
  for(let j=0;j<=16;j++){const t=a+Math.PI/2+j*Math.PI/16;ring.push([snap(p.x+width*Math.cos(t)),snap(p.z+width*Math.sin(t))]);}
  ring.push(ring[0]);return [ring];
 }));
 const polygons=polygonClipping.union(...capsules);cache.set(width,polygons);return polygons;
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
// Clip land to the exact water network, so coarse terrain cells cannot appear as
// square islands. The bank is a separate, smoothly rising continuous strip.
export function shorelineGeometry(points,water,bank){
 const geometries=[];
 for(let i=0;i<3;i++){
  const a=water+(bank-water)*i/3,b=water+(bank-water)*(i+1)/3,g=channelBankGeometry(points,b,a),p=g.attributes.position;
  for(let j=0;j<p.count;j++){const near=nearestOnTrack(points,p.getX(j),p.getZ(j)),d=Math.hypot(p.getX(j)-near.x,p.getZ(j)-near.z),t=Math.max(0,Math.min(1,(d-water)/(bank-water)));p.setY(j,-.06+.41*t*t*(3-2*t));}
  geometries.push(g);
 }
 const positions=geometries.flatMap(g=>{const p=g.attributes.position,idx=g.index?.array;return Array.from(idx||{length:p.count},(_,i)=>{const j=idx?idx[i]:i;return [p.getX(j),p.getY(j),p.getZ(j)];}).flat();});
 const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const result=mergeVertices(raw,1e-4);result.computeVertexNormals();raw.dispose();for(const g of geometries)g.dispose();return result;
}
export function landGeometry(points,width){
 const land=geometryFromPolygons(polygonClipping.difference([[[[-125,-110],[125,-110],[125,110],[-125,110],[-125,-110]]]],channelPolygons(points,width)));
 const pos=land.attributes.position,idx=land.index.array,vertices=[];
 const subdivide=(a,b,c,depth=0)=>{
  const lengths=[Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[0]-c[0],b[2]-c[2]),Math.hypot(c[0]-a[0],c[2]-a[2])],longest=lengths.indexOf(Math.max(...lengths));
  if(depth<9&&lengths[longest]>12){
   const v=[a,b,c],p=v[longest],q=v[(longest+1)%3],r=v[(longest+2)%3],mid=[(p[0]+q[0])/2,0,(p[2]+q[2])/2];
   subdivide(p,mid,r,depth+1);subdivide(mid,q,r,depth+1);
  }else vertices.push(...a,...b,...c);
 };
 for(let i=0;i<idx.length;i+=3)subdivide(...[idx[i],idx[i+1],idx[i+2]].map(j=>[pos.getX(j),0,pos.getZ(j)]));
 const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const result=mergeVertices(raw,1e-4);raw.dispose();land.dispose();
 const p=result.attributes.position,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n=nearestOnTrack(points,x,z),d=Math.hypot(x-n.x,z-n.z),t=Math.max(0,Math.min(1,(d-width)/12));p.setY(i,.35+t*t*(3-2*t)*(.65+Math.sin(x*.08)*Math.cos(z*.09)*.4));uv[i*2]=(x+125)/250;uv[i*2+1]=(110-z)/220;}
 result.setAttribute('uv',new THREE.BufferAttribute(uv,2));result.computeVertexNormals();return result;
}
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
