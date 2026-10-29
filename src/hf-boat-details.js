import * as THREE from 'three';

function gaugeTexture(){
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x-64)/64,dy=(64-y)/64,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx),tick=r>.72&&r<.9&&Math.abs(Math.sin(a*24))<.19,needle=Math.abs(dy-dx*.8)<.035&&dx>-.1&&dx<.64;
  const c=r>.94?110:tick?225:needle?230:18,i=(y*size+x)*4;data[i]=c;data[i+1]=needle?65:c;data[i+2]=needle?42:c;data[i+3]=255;
 }const t=new THREE.DataTexture(data,size,size);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}
export function boatDetail(boat,{paint,metal,rubber,seat,red,add}){
 const tube=(a,b,r=.025,material=metal)=>{const d=new THREE.Vector3().subVectors(b,a),m=add(boat,new THREE.CylinderGeometry(r,r,d.length(),10),material);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,d.normalize());return m;};
 // Rolled cockpit coaming, removable rear braces, polished fasteners and fuel plumbing.
 for(const z of [-.69,.69]){
  tube(new THREE.Vector3(-.58,.81,z),new THREE.Vector3(.92,.81,z),.045,rubber);
  tube(new THREE.Vector3(-1.62,.72,z),new THREE.Vector3(-.4,1.78,z),.037);
  for(let i=0;i<6;i++)add(boat,new THREE.CylinderGeometry(.022,.022,.014,6),metal,-1.6+i*.27,1.48,z*.49);
  tube(new THREE.Vector3(-1.4,1.37,z*.6),new THREE.Vector3(-.64,1.3,z*.58),.016,rubber);
  add(boat,new THREE.BoxGeometry(1.5,.05,.025),red,.8,.78,z*.95);
 }
 add(boat,new THREE.BoxGeometry(.1,.36,1.18),rubber,.86,1.02);
 const dial=new THREE.MeshStandardMaterial({map:gaugeTexture(),roughness:.3,metalness:.25});
 for(const [z,r,y] of [[-.35,.105,1.1],[-.12,.06,1.1],[.07,.06,1.1],[.29,.075,1.1]]){const gauge=add(boat,new THREE.CircleGeometry(r,24),dial,.801,y,z);gauge.rotation.y=-Math.PI/2;const ring=add(boat,new THREE.TorusGeometry(r,.008,6,24),metal,.79,y,z);ring.rotation.y=Math.PI/2;}
 for(let i=0;i<3;i++)tube(new THREE.Vector3(.62,1.17,-.35),new THREE.Vector3(.62,1.17+Math.cos(i*2.094)*.14,-.35+Math.sin(i*2.094)*.14),.012);
 for(const z of [-.35,.35]){
  // Padded headrests, stitched seat bolsters, and a four-point harness.
  add(boat,new THREE.CapsuleGeometry(.075,.28,4,8),seat,-.13,1.2,z-.21);
  add(boat,new THREE.CapsuleGeometry(.075,.28,4,8),seat,-.13,1.2,z+.21);
  tube(new THREE.Vector3(.285,1.37,z-.11),new THREE.Vector3(.325,1.06,z+.07),.022,rubber);
  tube(new THREE.Vector3(.285,1.37,z+.11),new THREE.Vector3(.325,1.06,z-.07),.022,rubber);
  add(boat,new THREE.SphereGeometry(.04,8,6),metal,.33,1.08,z);
 }
 // Local-space finish follows pitch/bank and keeps the original hull bounds.
 paint.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 hullPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhullPoint=position;');
  shader.fragmentShader='varying vec3 hullPoint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float stripe=smoothstep(.39,.42,hullPoint.y)*(1.-smoothstep(.49,.515,hullPoint.y))*smoothstep(.65,.78,abs(hullPoint.z));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025,.17,.15),stripe);
   float pin=smoothstep(.52,.525,hullPoint.y)*(1.-smoothstep(.54,.545,hullPoint.y))*smoothstep(.65,.78,abs(hullPoint.z));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.24,.08),pin);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float wet=1.-smoothstep(.27,.66,hullPoint.y);roughnessFactor=mix(roughnessFactor,.065,wet*.8);
  `);
 };paint.customProgramCacheKey=()=> 'HF wet fiberglass livery';
}
