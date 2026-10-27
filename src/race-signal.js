import * as THREE from 'three';
export function createRaceSignal(scene,start,tangent){
 const group=new THREE.Group();group.position.set(start.x-tangent.z*13,0,start.z+tangent.x*13);scene.add(group);
 const metal=new THREE.MeshStandardMaterial({color:0x171d20,metalness:.65,roughness:.55}),steel=new THREE.MeshStandardMaterial({color:0x707976,metalness:.8,roughness:.4});
 const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;};
 add(new THREE.CylinderGeometry(.12,.18,5,8),steel,0,2.5,0);add(new THREE.BoxGeometry(1.35,3.55,.65),metal,0,4.2,0);
 for(const y of [3,5.4]){add(new THREE.BoxGeometry(1.6,.12,.3),steel,0,y,-.4);for(const x of [-.56,.56])add(new THREE.SphereGeometry(.055,6,4),steel,x,y,.34);}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,4,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.55)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const glowMap=new THREE.CanvasTexture(canvas);
 const scuffs=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.008,.008),new THREE.MeshStandardMaterial({color:0x444e4b,roughness:.95,metalness:.2}),8);const scratch=new THREE.Matrix4();for(let i=0;i<8;i++){scratch.makeScale(.08+(i%3)*.06,1,1);scratch.setPosition(i%2?.5:-.48,2.7+i*.4,.334);scuffs.setMatrixAt(i,scratch);}group.add(scuffs);
 const lamps=[0xffbb30,0xffbb30,0x45ff88].map((color,i)=>{const y=5.25-i*1.05,bezel=add(new THREE.TorusGeometry(.45,.075,6,16),metal,0,y,.36);const lensMaterial=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0,metalness:.25,roughness:.19});const lens=add(new THREE.SphereGeometry(.39,16,10),lensMaterial,0,y,.35);lens.scale.z=.22;add(new THREE.BoxGeometry(1.02,.09,.65),metal,0,y+.46,.55);const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color,transparent:true,opacity:.6,depthWrite:false}));glow.position.set(0,y,.51);glow.scale.set(1.4,1.4,1);group.add(glow);return {lens,lensMaterial,glow};});
 return {update(state){for(const [i,key] of ['upper','lower','green'].entries()){const on=state[key];lamps[i].lensMaterial.emissiveIntensity=on?2.5:.015;lamps[i].lensMaterial.color.setHex(on?(i===2?0x45ff88:0xffbb30):0x27302b);lamps[i].glow.visible=on;}}};
}
