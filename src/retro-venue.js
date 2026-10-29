import * as THREE from 'three';
import {displayFont,interfaceFont,repaintAfterFonts} from './typography.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {racingBoat} from './visuals.js';
import {venueLayout,spectatorLocations} from './venue-layout.js';
import {venueMaterials} from './hf-venue-materials.js';

// Static props are baked into one mesh per material, not one draw per plank.
// People use instanced body parts; only their 48 arms animate. No skeletons.
export function createRetroVenue(scene,nearest){
 const staticRoot=new THREE.Group(),animated=new THREE.Group();scene.add(animated);
 const colors={wood:'#79624d',plank:'#a58c69',roof:'#3c514c',trim:'#d6c5a0',glass:'#ffd08a',black:'#242c2b',metal:'#818e8a',rust:'#985638',cream:'#e8d5ac',red:'#ba503e',teal:'#367a7a',yellow:'#dfb247',navy:'#344b64',skin:'#c78f6c',white:'#e2dfcf',dirt:'#a18b63'};
 const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.85,metalness:key==='metal'?.4:0})]));
 mats.glass.emissive.set('#e6a65d');mats.glass.emissiveIntensity=.7;
 venueMaterials(mats);
 const siding=document.createElement('canvas');siding.width=siding.height=128;const ctx=siding.getContext('2d');ctx.fillStyle='#a99a82';ctx.fillRect(0,0,128,128);
 for(let y=0;y<128;y+=16){ctx.fillStyle=y%32?'#807766':'#9a8d77';ctx.fillRect(0,y,128,1);for(let x=0;x<128;x+=7){ctx.fillStyle='#3b33291a';ctx.fillRect(x,y+3+(x%5),12,1);}}
 const woodTexture=new THREE.CanvasTexture(siding);woodTexture.colorSpace=THREE.SRGBColorSpace;woodTexture.wrapS=woodTexture.wrapT=THREE.RepeatWrapping;woodTexture.repeat.set(2,2);mats.wood.map=woodTexture;
 const boxGeo=new THREE.BoxGeometry(1,1,1),cylinderGeo=new THREE.CylinderGeometry(1,1,1,16),sphereGeo=new THREE.SphereGeometry(1,12,8),tireGeo=new THREE.TorusGeometry(.45,.15,5,10);
 function item(g,m,x,y,z,sx=1,sy=1,sz=1,parent=staticRoot){const o=new THREE.Mesh(g,mats[m]||m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 const box=(m,x,y,z,sx,sy,sz,parent)=>item(boxGeo,m,x,y,z,sx,sy,sz,parent);
 function group(x,z,rotation=0){const g=new THREE.Group();g.position.set(x,.4,z);g.rotation.y=rotation;staticRoot.add(g);return g;}
 function pole(m,x,y,z,r,h,parent){return item(cylinderGeo,m,x,y,z,r,h,r,parent);}
 function sign(text,sub,width,height,x,y,z,parent,color='#d9c394'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const c=canvas.getContext('2d');const draw=()=>{c.fillStyle='#273e3c';c.fillRect(0,0,512,160);c.strokeStyle=color;c.lineWidth=10;c.strokeRect(8,8,496,144);c.fillStyle=color;c.textAlign='center';c.font=`400 41px ${displayFont}`;c.fillText(text,256,71,474);c.font=`700 22px ${interfaceFont}`;c.fillText(sub,256,112,470);for(let i=0;i<42;i++){c.fillStyle='#d5c39a18';c.fillRect((i*97)%512,(i*37)%160,30,2);}
  };draw();const t=new THREE.CanvasTexture(canvas);repaintAfterFonts(()=>{draw();t.needsUpdate=true;});t.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshStandardMaterial({map:t,roughness:1,side:THREE.DoubleSide});return item(new THREE.PlaneGeometry(width,height),material,x,y,z,1,1,1,parent);
 }
 function chair(x,z,parent,color='teal'){
  box(color,x,.95,z,1.05,.14,1.05,parent);const back=box(color,x,1.5,z-.48,1.05,1,.12,parent);back.rotation.x=-.12;
  for(const sx of [-.5,.5])for(const sz of [-.45,.45]){const leg=box('metal',x+sx,.5,z+sz,.07,1,.07,parent);leg.rotation.z=sx*.3;}
 }
 function cooler(x,z,parent){box('teal',x,.5,z,1.3,.7,.8,parent);box('cream',x,.9,z,1.4,.12,.9,parent);box('metal',x,.55,z+.43,.7,.08,.06,parent);}
 function fence(x,z,count,parent){for(let i=0;i<=count;i++)box('wood',x+i*2,.9,z,.12,1.8,.12,parent);for(const y of [.6,1.2])box('plank',x+count,y,z,count*2,.11,.1,parent);}
 function roof(parent,width,depth,y){
  const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(0,2.5);shape.lineTo(width/2,0);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});item(geo,'roof',0,y,-depth/2,1,1,1,parent);
 }
 // The organizer's office, facing the staging inlet.
 const cabin=group(venueLayout.cabin.x,venueLayout.cabin.z);
 box('wood',0,2.6,0,10,4.5,8,cabin);roof(cabin,12,11,4.9);
 box('wood',3,6.7,-1.8,1,3.8,1,cabin);box('metal',3,8.7,-1.8,1.3,.25,1.3,cabin);
 box('plank',0,.35,5.4,12,.3,3.6,cabin);box('black',0,1.9,4.05,1.5,3,.08,cabin);box('wood',.05,1.8,4.13,1.3,2.7,.08,cabin);
 box('metal',.52,1.8,4.21,.07,.2,.07,cabin);for(const side of [-1,1]){box('trim',side*5.1,2.65,0,.16,4.5,8.1,cabin);box('plank',side*5.9,4.85,0,.12,.14,11,cabin);}
 for(const x of [-3.1,3.1]){box('trim',x,2.8,4.1,2,1.7,.12,cabin);box('glass',x,2.8,4.19,1.7,1.4,.05,cabin);box('wood',x,2.8,4.25,.07,1.5,.08,cabin);box('wood',x,2.8,4.25,1.8,.07,.08,cabin);}
 for(const x of [-5.4,5.4]){box('plank',x,2.55,6.7,.18,4.5,.18,cabin);box('plank',x,1,5.35,.1,.1,2.6,cabin);}
 for(let i=-5;i<=5;i++)if(Math.abs(i)>1)box('wood',i,.95,7,.07,1.1,.07,cabin);
 for(const x of [-3.5,3.5])box('plank',x,1.5,7,4.6,.12,.12,cabin);
 for(let i=0;i<3;i++)box('plank',0,.22-i*.13,7.5+i*.5,2,.2,.55,cabin);
 pole('metal',1.4,3.8,4.45,.18,.6,cabin);item(sphereGeo,'glass',1.4,3.65,4.5,.2,.26,.2,cabin);
 chair(-4.1,5.5,cabin);chair(3.8,5.6,cabin,'red');
 for(let i=0;i<12;i++){const log=pole('wood',-5.9,.3+Math.floor(i/4)*.4,-1+(i%4)*.45,.2,1.4,cabin);log.rotation.z=Math.PI/2;}
 sign('CEDAR CREEK','RACE OFFICE / EST. 1978',6,1.5,0,4.3,4.4,cabin);
 sign('SATURDAY HEATS','10:00 PRACTICE / 14:00 RACING',2.9,1.9,6.6,1.8,3,cabin,'#e9d7a9');
 // Old square-body pickup and a modest pile of maintenance equipment.
 const truck=group(venueLayout.pickup.x,venueLayout.pickup.z,.35);
 box('teal',0,1,0,3.3,.6,6.8,truck);box('teal',0,1.9,-.7,3,1.8,2.6,truck);box('black',0,2.1,.65,2.7,1,.08,truck);box('metal',0,1,3.55,3.4,.22,.2,truck);box('black',0,1.1,2,2.7,.08,2,truck);
 for(const side of [-1,1]){box('black',side*1.53,2.1,-.7,.06,.95,1.8,truck);for(const z of [-2.2,2.2]){const t=item(tireGeo,'black',side*1.65,.75,z,1.5,1.5,1.1,truck);t.rotation.y=Math.PI/2;}}
 box('black',0,1.3,-3.45,2.9,.4,.08,truck);for(let i=-5;i<=5;i++)box('metal',i*.21,1.3,-3.51,.035,.3,.035,truck);for(const side of [-1,1]){box('cream',side*1.24,1.4,-3.51,.42,.3,.07,truck);box('metal',side*1.75,2.2,-.3,.27,.24,.3,truck);box('rust',side*1.66,.9,2.6,.06,.1,.5,truck);}
 // Small timing booth, launch approach, dirt paths and a parked boat trailer.
 const booth=group(-21,-39,.1);box('wood',0,1.5,0,3,2.6,2.6,booth);roof(booth,3.8,3.8,2.9);box('glass',0,1.9,1.35,2.4,.8,.05,booth);sign('RACE CONTROL','CEDAR CREEK / SUMMER 87',3.2,.7,0,2.8,1.5,booth);
 const trailer=group(-49,-52,.35);box('metal',0,.7,0,2.7,.12,6.5,trailer);box('metal',0,.65,3.8,.12,.12,2,trailer);for(const side of [-1,1]){const tire=item(tireGeo,'black',side*1.45,.5,.7,1.2,1.2,1.2,trailer);tire.rotation.y=Math.PI/2;box('plank',side*.8,.9,0,.25,.15,5.5,trailer);}

 // Dock occupies only the dead-end staging inlet, well outside the lap route.
 const dock=group(venueLayout.dock.x,venueLayout.dock.z);
 for(let i=0;i<16;i++){box('plank',0,.18,-4+i*.5,2.8,.16,.46,dock);for(const side of [-1,1])pole('metal',side*1.15,.269,-4+i*.5,.024,.012,dock);}
 for(const x of [-1.3,1.3])for(const z of [-4,0,3.5]){pole('wood',x,-.1,z,.14,2.5,dock);box('metal',x,.42,z,.5,.07,.12,dock);}
 for(const z of [-2,1.8]){item(tireGeo,'black',1.65,.1,z,1,1,1,dock);}
 sign('JET SPRINT RACING','CEDAR CREEK / STAGING ONLY',6,1.6,-1.5,3,-4.3,dock);
 for(const x of [-3,-4.4]){pole('rust',x,.6,-6.8,.5,1.2,dock);pole('cream',x,.65,-6.8,.51,.15,dock);}
 const parked=racingBoat(animated);parked.position.set(venueLayout.dock.x+3.5,.15,venueLayout.dock.z+.5);parked.rotation.y=Math.PI/2;parked.scale.setScalar(.85);
 // Fixed low-opacity rings at dock posts suggest small lapping ripples.
 const rippleMaterial=new THREE.MeshBasicMaterial({color:'#bfd3ba',transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
 const ripples=[-2.5,1.8].map(z=>{const ring=new THREE.Mesh(new THREE.RingGeometry(.45,.52,16),rippleMaterial);ring.rotation.x=-Math.PI/2;ring.position.set(venueLayout.dock.x+1.5,.045,venueLayout.dock.z+z);animated.add(ring);return ring;});
 // Clear viewing terraces, picnic equipment, fictional recurring local sponsors.
 for(const [i,p] of venueLayout.viewing.entries()){
  const terrace=group(p.x,p.z);const near=nearest(p.x,p.z);terrace.rotation.y=Math.atan2(near.x-p.x,near.z-p.z);
  box('dirt',0,.02,0,13,.08,7,terrace);fence(-6,2,6,terrace);
  for(const x of [-4,1.5])chair(x,-1,terrace,i%2?'red':'yellow');cooler(4,-1.5,terrace);
  pole('wood',-5,2,-2,.06,4,terrace);const umbrella=item(new THREE.ConeGeometry(2.5,1,8),'cream',-5,4,-2,1,1,1,terrace);umbrella.rotation.y=i;
  box('navy',3,1,-1.5,.9,.5,.4,terrace);pole('metal',3.4,1.7,-1.5,.015,1.1,terrace);
  const banner=sign(i===0?'MOSSBACK MARINE':i===1?'CASCADE MOTOR OIL':'CEDAR COUNTY 87',i===0?'REPAIRS / PARTS / COFFEE':i===1?'BIG BLOCKS. SMALL TOWN.':'FIGURE EIGHT INVITATIONAL',8,1.3,0,1.4,2.15,terrace,i===1?'#de9777':'#dfc48b');banner.rotation.y=0;
 }
 const dockTerrace=group(venueLayout.dockViewing.x,venueLayout.dockViewing.z);cooler(2,-1,dockTerrace);fence(-4,2,4,dockTerrace);
 // Batched rocks/reeds along both banks, safely outside the hull corridor.
 let seed=1987;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<130;i++){const x=(random()-.5)*150,z=(random()-.5)*90,n=nearest(x,z),d=Math.hypot(x-n.x,z-n.z);if(d<9.8||d>12)continue;for(let j=0;j<3;j++){const reed=box('roof',x+j*.12,.5,z+j*.13,.055,.7+random()*.6,.055);reed.rotation.z=(random()-.5)*.4;}}
 // Distant hills are closed low-poly masses; no expensive terrain LOD system.
 for(let i=0;i<13;i++){const hill=item(new THREE.SphereGeometry(1,24,12),'roof',-115+i*20,6+random()*6,-91-random()*12,18+random()*12,20+random()*18,13+random()*10);hill.rotation.y=random()*3;}
 const people=spectatorLocations();
 for(const p of people){const n=nearest(p.x,p.z);p.angle=Math.atan2(n.x-p.x,n.z-p.z);p.height=p.seated?1.5:1.65;if(p.seated){const seat=group(p.x,p.z,p.angle);seat.scale.setScalar(.7);chair(0,0,seat,'cream');}}
 staticRoot.updateMatrixWorld(true);const batches=new Map();staticRoot.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index){const flat=g.toNonIndexed();g.dispose();if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(flat);}else{if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);}});
 const staticMeshes=[];for(const [material,geometries] of batches){const merged=mergeGeometries(geometries);for(const g of geometries)g.dispose();const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name='Retro venue static batch';scene.add(mesh);staticMeshes.push(mesh);}
 // Varied tees, denim shorts, sun caps and simple seated/standing poses.
 const skinColors=['#b77d59','#d6a47f','#976747','#d6b494'],shirtColors=['#d8a45a','#b85558','#589895','#d7d0af','#507598','#a589a6'];
 const bodyGeometry=new THREE.LatheGeometry([new THREE.Vector2(.34,-.5),new THREE.Vector2(.46,-.2),new THREE.Vector2(.5,.28),new THREE.Vector2(.3,.5)],12),limbGeometry=new THREE.CylinderGeometry(.5,.42,1,10);
 const torso=new THREE.InstancedMesh(bodyGeometry,new THREE.MeshStandardMaterial({roughness:1}),24),legs=new THREE.InstancedMesh(limbGeometry,mats.navy,48),heads=new THREE.InstancedMesh(sphereGeo,new THREE.MeshStandardMaterial({roughness:1}),24),caps=new THREE.InstancedMesh(cylinderGeo,mats.cream,24),arms=new THREE.InstancedMesh(limbGeometry,new THREE.MeshStandardMaterial({roughness:1}),48);
 for(const m of [torso,legs,heads,caps,arms]){m.castShadow=true;m.frustumCulled=false;animated.add(m);}arms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
 function place(inst,i,x,y,z,sx,sy,sz,yaw=0){matrix.compose(position.set(x,y,z),rotation.setFromAxisAngle(axis,yaw),scale.set(sx,sy,sz));inst.setMatrixAt(i,matrix);}
 people.forEach((p,i)=>{
  place(torso,i,p.x,p.height,p.z,.58,.85,.32,p.angle);torso.setColorAt(i,new THREE.Color(shirtColors[i%shirtColors.length]));
  place(heads,i,p.x,p.height+.68,p.z,.24,.28,.24);heads.setColorAt(i,new THREE.Color(skinColors[i%4]));place(caps,i,p.x,p.height+.91,p.z,.27,.08,.3);
  for(const side of [-1,1]){const x=p.x+Math.cos(p.angle)*side*.16,z=p.z-Math.sin(p.angle)*side*.16;place(legs,i*2+(side===1?1:0),x,p.seated?.7:.65,z,.22,p.seated?.5:1.1,p.seated?.6:.26,p.angle);}
 });
 for(let i=0;i<48;i++)arms.setColorAt(i,new THREE.Color(shirtColors[Math.floor(i/2)%shirtColors.length]));
 const armRoot=new THREE.Matrix4(),armRotation=new THREE.Matrix4(),armOffset=new THREE.Matrix4().makeTranslation(0,-.3,0);
 let age=0,activePeople=24;
 return {people,staticMeshes,animated,setDrawDistance(distance,focus){for(const m of staticMeshes){if(!m.geometry.boundingSphere)m.geometry.computeBoundingSphere();const s=m.geometry.boundingSphere;m.visible=s.center.distanceTo(focus)-s.radius<distance;}},getSpectatorCount:()=>activePeople,setDensity(fraction){activePeople=Math.round(24*fraction);torso.count=heads.count=caps.count=activePeople;legs.count=arms.count=activePeople*2;},update(dt,boat){
  age+=dt;parked.position.y=.15+Math.sin(age*1.7)*.025;parked.rotation.z=Math.sin(age*1.3)*.008;
  for(let i=0;i<ripples.length;i++)ripples[i].scale.setScalar(1+(Math.sin(age*1.4+i)+1)*.3);
  // A nearby passing boat triggers a short wave/clap, otherwise gentle arm sway.
  people.forEach((p,i)=>{
   if(i>=activePeople)return;
   const close=Math.hypot(boat.x-p.x,boat.z-p.z)<31,cheer=close&&Math.sin(age*.8+p.phase)>.05;
   for(const side of [-1,1]){
    const index=i*2+(side===1?1:0),swing=cheer?(-1.8+Math.sin(age*5+p.phase)*.5)*side:Math.sin(age*1.2+p.phase)*.07;
    const x=p.x+Math.cos(p.angle)*side*.4,z=p.z-Math.sin(p.angle)*side*.4;
    armRoot.makeRotationY(p.angle);armRotation.makeRotationZ(swing);armRoot.setPosition(x,p.height+.3,z);matrix.copy(armRoot).multiply(armRotation).multiply(armOffset).scale(scale.set(.16,.65,.18));arms.setMatrixAt(index,matrix);
   }
  });arms.instanceMatrix.needsUpdate=true;
 }};
}
