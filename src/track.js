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
 // Split marked edges globally, including their neighbouring triangles.
 // Independent recursive triangle splits create T-junctions: after elevation
 // is applied, the unmatched midpoints leave visible cracks in the grass.
 const positions=land.attributes.position,vertices=Array.from({length:positions.count},(_,i)=>[positions.getX(i),0,positions.getZ(i)]);
 let faces=Array.from(land.index.array);
 const edgeKey=(a,b)=>a<b?`${a}/${b}`:`${b}/${a}`;
 for(let pass=0;pass<10;pass++){
  const midpoints=new Map();
  for(let i=0;i<faces.length;i+=3)for(let j=0;j<3;j++){
   const a=faces[i+j],b=faces[i+(j+1)%3],key=edgeKey(a,b),p=vertices[a],q=vertices[b];
   if(!midpoints.has(key)&&Math.hypot(p[0]-q[0],p[2]-q[2])>12){midpoints.set(key,vertices.length);vertices.push([(p[0]+q[0])/2,0,(p[2]+q[2])/2]);}
  }
  if(!midpoints.size)break;
  const next=[];
  for(let i=0;i<faces.length;i+=3){
   const v=faces.slice(i,i+3),m=v.map((a,j)=>midpoints.get(edgeKey(a,v[(j+1)%3]))),count=m.filter(x=>x!==undefined).length;
   if(count===0)next.push(...v);
   else if(count===3)next.push(v[0],m[0],m[2],m[0],v[1],m[1],m[2],m[1],v[2],m[0],m[1],m[2]);
   else if(count===1){const j=m.findIndex(x=>x!==undefined),a=v[j],b=v[(j+1)%3],c=v[(j+2)%3];next.push(a,m[j],c,m[j],b,c);}
   else{const j=m.findIndex((x,j)=>x!==undefined&&m[(j+1)%3]!==undefined),a=v[j],b=v[(j+1)%3],c=v[(j+2)%3],p=m[j],q=m[(j+1)%3];next.push(b,q,p,a,p,c,p,q,c);}
  }
  faces=next;
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));result.setIndex(faces);land.dispose();
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
