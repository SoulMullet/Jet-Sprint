import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
// Union capsule segments before triangulating. Offset ribbons fold over themselves
// when the inside radius is smaller than channel width, flipping lit normals.
export function channelGeometry(points,width){
 const capsules=points.map((p,i)=>{
  const q=points[(i+1)%points.length],a=Math.atan2(q.z-p.z,q.x-p.x),ring=[];
  for(let j=0;j<=8;j++){const t=a-Math.PI/2+j*Math.PI/8;ring.push([q.x+width*Math.cos(t),q.z+width*Math.sin(t)]);}
  for(let j=0;j<=8;j++){const t=a+Math.PI/2+j*Math.PI/8;ring.push([p.x+width*Math.cos(t),p.z+width*Math.sin(t)]);}
  ring.push(ring[0]);return [ring];
 });
 const polygons=polygonClipping.union(...capsules);
 const shapes=polygons.map(rings=>{
  const shape=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const ring of rings.slice(1))shape.holes.push(new THREE.Path(ring.map(([x,z])=>new THREE.Vector2(x,-z))));
  return shape;
 });
 const geometry=new THREE.ShapeGeometry(shapes);geometry.rotateX(-Math.PI/2);return geometry;
}
export function nearestOnTrack(points,x,z){
 let best=Infinity,px=0,pz=0,index=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
  const qx=a.x+t*dx,qz=a.z+t*dz,d=(x-qx)**2+(z-qz)**2;
  if(d<best){best=d;px=qx;pz=qz;index=i;}
 }
 return {x:px,z:pz,index};
}
