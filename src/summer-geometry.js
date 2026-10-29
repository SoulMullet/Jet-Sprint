import * as THREE from 'three';
// A smooth, irregular branch profile instead of straight-sided cone tiers.
export function pineCrown(){
 const vertices=[],indices=[],uv=[],rings=16,sides=16;
 for(let y=0;y<=rings;y++)for(let j=0;j<sides;j++){
  const t=y/rings,a=j/sides*Math.PI*2,envelope=Math.pow(1-t,.72)*2;
  const r=envelope*(.95+.05*Math.cos(t*Math.PI*12))*(1+.035*Math.sin(a*5+y*1.7));vertices.push(Math.cos(a)*r,t*4,Math.sin(a)*r);uv.push(j/sides,t);
  if(y<rings){const p=y*sides+j,q=y*sides+(j+1)%sides;indices.push(p,p+sides,q,q,p+sides,q+sides);}
 }
 const center=vertices.length/3;vertices.push(0,.15,0);uv.push(.5,.5);for(let j=0;j<sides;j++)indices.push(center,j,(j+1)%sides);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
