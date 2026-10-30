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
  const radius=width+(points.baseWidth===undefined?0:(path.waterWidth??points.baseWidth)-points.baseWidth);
  const q=path[(i+1)%path.length],a=Math.atan2(q.z-p.z,q.x-p.x),ring=[];
  // Millimetre snapping removes near-coincident sweep-line intersections
  // across JS engines without changing the visible or collidable shoreline.
  const snap=x=>Math.round(x*1000)/1000;
  for(let j=0;j<=16;j++){const t=a-Math.PI/2+j*Math.PI/16;ring.push([snap(q.x+radius*Math.cos(t)),snap(q.z+radius*Math.sin(t))]);}
  for(let j=0;j<=16;j++){const t=a+Math.PI/2+j*Math.PI/16;ring.push([snap(p.x+radius*Math.cos(t)),snap(p.z+radius*Math.sin(t))]);}
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
  for(let j=0;j<p.count;j++){const near=nearestOnTrack(points,p.getX(j),p.getZ(j)),d=Math.hypot(p.getX(j)-near.x,p.getZ(j)-near.z),t=Math.max(0,Math.min(1,(d-(near.waterWidth??water))/(bank-water)));p.setY(j,-.06+.41*t*t*(3-2*t));}
  geometries.push(g);
 }
 const positions=geometries.flatMap(g=>{const p=g.attributes.position,idx=g.index?.array;return Array.from(idx||{length:p.count},(_,i)=>{const j=idx?idx[i]:i;return [p.getX(j),p.getY(j),p.getZ(j)];}).flat();});
 const raw=new THREE.BufferGeometry();raw.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const result=mergeVertices(raw,1e-4);result.computeVertexNormals();raw.dispose();for(const g of geometries)g.dispose();return result;
}
export function landGeometry(points,width){
 const b=points.bounds??{minX:-125,maxX:125,minZ:-110,maxZ:110};
 const land=geometryFromPolygons(polygonClipping.difference([[[[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ],[b.minX,b.minZ]]]],channelPolygons(points,width)));
 // Jetsprint parks occupy a graded floodplain. Flat clipped ground avoids
 // lifting near-collinear Earcut slivers into dark folds across the grass.
 // Surrounding hills provide relief without tessellating an entire far field.
 if(points.gradedFloodplain){const p=land.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){p.setY(i,.35);uv[i*2]=(p.getX(i)+125)/250;uv[i*2+1]=(110-p.getZ(i))/220;}land.setAttribute('uv',new THREE.BufferAttribute(uv,2));land.computeVertexNormals();return land;}
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
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n=nearestOnTrack(points,x,z),d=Math.hypot(x-n.x,z-n.z),localBank=(n.waterWidth??points.baseWidth??9)+(width-(points.baseWidth??9)),t=Math.max(0,Math.min(1,(d-localBank)/12));p.setY(i,.35+t*t*(3-2*t)*(.65+Math.sin(x*.08)*Math.cos(z*.09)*.4));uv[i*2]=(x+125)/250;uv[i*2+1]=(110-z)/220;}
 result.setAttribute('uv',new THREE.BufferAttribute(uv,2));result.computeVertexNormals();return result;
}
const queryCache=new WeakMap(),cellSize=16;
function indexNetwork(points){
 const segments=[],columns=new Map();let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const path of points.paths||[points])for(let i=0,n=path.length-(points.paths?1:0);i<n;i++){
  const a=path[i],b=path[(i+1)%path.length],radius=points.baseWidth===undefined?0:path.waterWidth??points.baseWidth;
  const segment={a,b,path,i,radius,mark:0};segments.push(segment);
  const x0=Math.floor((Math.min(a.x,b.x)-radius)/cellSize),x1=Math.floor((Math.max(a.x,b.x)+radius)/cellSize),z0=Math.floor((Math.min(a.z,b.z)-radius)/cellSize),z1=Math.floor((Math.max(a.z,b.z)+radius)/cellSize);
  minX=Math.min(minX,x0);maxX=Math.max(maxX,x1);minZ=Math.min(minZ,z0);maxZ=Math.max(maxZ,z1);
  for(let x=x0;x<=x1;x++){if(!columns.has(x))columns.set(x,new Map());const col=columns.get(x);for(let z=z0;z<=z1;z++){if(!col.has(z))col.set(z,[]);col.get(z).push(segment);}}
 }
 const cache={segments,columns,minX,maxX,minZ,maxZ,stamp:0};queryCache.set(points,cache);return cache;
}
export function nearestOnTrack(points,x,z){
 const cache=queryCache.get(points)||indexNetwork(points),stamp=++cache.stamp,cx=Math.floor(x/cellSize),cz=Math.floor(z/cellSize);
 let best=Infinity,px=0,pz=0,index=0,segmentId=null,along=0,waterWidth;
 const consider=segment=>{
  if(segment.mark===stamp)return;segment.mark=stamp;
  const {a,b,path,i,radius}=segment,dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1))),qx=a.x+t*dx,qz=a.z+t*dz;
  // With unequal widths choose the greatest water clearance at a merge.
  const d=points.baseWidth===undefined?(x-qx)**2+(z-qz)**2:Math.hypot(x-qx,z-qz)-radius;
  if(d<best){best=d;px=qx;pz=qz;index=a.routeIndex??i;segmentId=path.id||null;along=t;waterWidth=path.waterWidth;}
 };
 if(cx<cache.minX-8||cx>cache.maxX+8||cz<cache.minZ-8||cz>cache.maxZ+8){for(const segment of cache.segments)consider(segment);}
 else{
  const limit=Math.max(Math.abs(cx-cache.minX),Math.abs(cx-cache.maxX),Math.abs(cz-cache.minZ),Math.abs(cz-cache.maxZ));
  for(let r=0;r<=limit;r++){
   for(let ix=cx-r;ix<=cx+r;ix++){const col=cache.columns.get(ix);if(!col)continue;for(let iz=cz-r;iz<=cz+r;iz++){if(r&&ix!==cx-r&&ix!==cx+r&&iz!==cz-r&&iz!==cz+r)continue;const cell=col.get(iz);if(cell)for(const segment of cell)consider(segment);}}
   const boundary=Math.min(x-(cx-r)*cellSize,(cx+r+1)*cellSize-x,z-(cz-r)*cellSize,(cz+r+1)*cellSize-z);
   if(best<=(points.baseWidth===undefined?boundary*boundary:boundary))break;
  }
 }
 const out={x:px,z:pz,index,segmentId,t:along};if(waterWidth!==undefined){out.waterWidth=waterWidth;out.hullLimit=waterWidth-2.5;}return out;
}
