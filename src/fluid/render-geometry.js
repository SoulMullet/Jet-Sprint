import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
// Subdivide the existing clipped channel, never the rectangular solver domain.
// Midpoints stay on their original triangles, preserving shoreline and holes.
export function renderGeometry(channel,nearest,width){
 const geometry=new TessellateModifier(1.4,18).modify(channel);
 const pos=geometry.attributes.position,fade=new Float32Array(pos.count),gradient=new Float32Array(pos.count*2);
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),p=nearest(x,z),d=Math.hypot(x-p.x,z-p.z),t=THREE.MathUtils.clamp((width-d)/1.8,0,1);
  fade[i]=t*t*(3-2*t);const derivative=-6*t*(1-t)/1.8;
  gradient[i*2]=d>1e-6?derivative*(x-p.x)/d:0;gradient[i*2+1]=d>1e-6?derivative*(z-p.z)/d:0;
 }
 geometry.setAttribute('shoreFade',new THREE.BufferAttribute(fade,1));geometry.setAttribute('shoreGradient',new THREE.BufferAttribute(gradient,2));const indexed=mergeVertices(geometry,1e-5);geometry.dispose();return indexed;
}
