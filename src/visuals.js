import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {landGeometry} from './track.js';
import {channel} from './physics.js';
const make=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function add(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function texture(draw,size=256){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
export function lighting(scene,renderer){
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene.background=new THREE.Color('#abc0bf');scene.fog=new THREE.Fog('#abc0bf',105,240);
 scene.add(new THREE.HemisphereLight(0xc5dfec,0x48523b,1.7));const sun=new THREE.DirectionalLight(0xffd6a0,3.1);sun.position.set(-35,65,25);sun.castShadow=true;sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=160;sun.shadow.bias=-.0003;sun.shadow.normalBias=.08;scene.add(sun,sun.target);
 const sky=texture((ctx,n)=>{const g=ctx.createLinearGradient(0,0,0,n);g.addColorStop(0,'#759dae');g.addColorStop(.5,'#e6d8b9');g.addColorStop(.55,'#8c9271');g.addColorStop(1,'#293e35');ctx.fillStyle=g;ctx.fillRect(0,0,n,n);ctx.fillStyle='#fff2d3';ctx.beginPath();ctx.arc(n*.2,n*.3,10,0,Math.PI*2);ctx.fill();});sky.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromEquirectangular(sky);scene.environment=env.texture;pmrem.dispose();sky.dispose();
 return sun;
}
export function waterMaterial(points,width,time,boat,strength){
 const depth=texture((ctx,n)=>{ctx.fillStyle='#000';ctx.fillRect(0,0,n,n);ctx.lineJoin='round';ctx.lineCap='round';for(let i=0;i<24;i++){const f=i/24;ctx.strokeStyle=`rgb(${Math.round(30+f*225)},${Math.round(30+f*225)},${Math.round(30+f*225)})`;ctx.lineWidth=width*2*(1-f)*n/250;ctx.beginPath();for(const path of points.paths||[points])for(let j=0;j<path.length+(points.paths?0:1);j++){const p=path[j%path.length];j?ctx.lineTo((p.x+125)*n/250,(p.z+125)*n/250):ctx.moveTo((p.x+125)*n/250,(p.z+125)*n/250);}ctx.stroke();}},512);depth.colorSpace=THREE.NoColorSpace;depth.flipY=false;
 const quality={value:1},m=make('#367d7b',.32,.12);m.envMapIntensity=.75;
 m.onBeforeCompile=shader=>{
 Object.assign(shader.uniforms,{waterTime:time,waterBoat:boat,waterStrength:strength,channelDepth:{value:depth},waterQuality:quality});
 shader.vertexShader='varying vec2 surface;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurface=position.xz;');
 shader.fragmentShader='varying vec2 surface;uniform float waterTime;uniform vec3 waterBoat;uniform float waterStrength;uniform sampler2D channelDepth;uniform float waterQuality;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float depth=texture2D(channelDepth,(surface+125.)/250.).r;
 float waves=sin(dot(surface,vec2(.8,.35))+waterTime*1.5)*.65+sin(dot(surface,vec2(-.27,1.1))-waterTime*.8)*.35;
 float boatDist=length(surface-waterBoat.xz);
 float bow=sin(boatDist*4.-waterTime*10.)*exp(-boatDist*.27)*waterStrength;
 diffuseColor.rgb=mix(vec3(.18,.29,.22),vec3(.025,.14,.16),smoothstep(0.,.8,depth));
 float foam=(1.-smoothstep(.08,.28,depth))*(.65+.35*waves);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.73,.61),foam*.7);
 float detail=sin(surface.x*7.1+waterTime*3.1)*cos(surface.y*6.7-waterTime*2.3);
 diffuseColor.rgb+=(waves*.013+bow*.06)*min(1.,waterQuality)+detail*.008*max(0.,waterQuality-1.);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
 vec3 waveNormal=vec3(sin(dot(surface,vec2(.8,.35))+waterTime*1.5),sin(dot(surface,vec2(.7,.38))+waterTime*1.5+.3),0.)*.025;
 normal=normalize(normal+waveNormal*min(1.,waterQuality)+vec3(sin(dot(surface,vec2(2.5,.8))+waterTime*2.),sin(dot(surface,vec2(2.4,.9))+waterTime*2.),0.)*.006*max(0.,waterQuality-1.));`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float fresnel=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),4.);outgoingLight=mix(outgoingLight,vec3(.54,.67,.65),fresnel*.3*min(1.,waterQuality));\n#include <opaque_fragment>`);
 };return {material:m,quality};
}
export function terrain(scene,points,nearest,random,network=null){
 const tex=texture((ctx,n)=>{ctx.fillStyle='#687452';ctx.fillRect(0,0,n,n);for(let i=0;i<18000;i++){ctx.fillStyle=i%3?'#53604455':'#a2987555';ctx.fillRect(random()*n,random()*n,1+random()*4,1+random()*3);}});tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(16,14);
 const ground=make('#b2b293');ground.map=tex;const geo=network?landGeometry(network,channel.bank):new THREE.PlaneGeometry(250,220,90,80);
 if(!network){geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),p=nearest(x,z),d=Math.hypot(x-p.x,z-p.z);pos.setY(i,-.21-1.3*Math.max(0,1-(d/7.3)**2)+Math.max(0,Math.min(1,(d-10)/12))*(.5+Math.sin(x*.1)*Math.cos(z*.13)*1.4));}geo.computeVertexNormals();}add(scene,geo,ground);
 const bark=make('#534a3b'),leaf=make('#304d3c'),rock=make('#75776c'),shrub=make('#647447');
 const trees=[],details=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),v=new THREE.Vector3();
 for(let i=0;i<280;i++){const x=(random()-.5)*190,z=(random()-.5)*160,p=nearest(x,z);if(Math.hypot(x-p.x,z-p.z)>13)trees.push({x,z,size:1+random()*1.4,type:i%3,rotation:random()*6.28});}
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.32,5,7),bark,trees.length);const crowns=new THREE.InstancedMesh(new THREE.ConeGeometry(2,4,9),leaf,trees.length*3);scene.add(trunks,crowns);trunks.castShadow=crowns.castShadow=true;trunks.receiveShadow=crowns.receiveShadow=true;
 trees.forEach((t,i)=>{q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,t.rotation);matrix.compose(v.set(t.x,2.2*t.size,t.z),q,scale.set(1,t.size,1));trunks.setMatrixAt(i,matrix);for(let j=0;j<3;j++){const taper=1-j*.22;matrix.compose(v.set(t.x,(3+j*1.4)*t.size,t.z),q,scale.set(t.size*taper*(t.type===1?.8:1),t.size*(t.type===2?.8:1),t.size*taper));crowns.setMatrixAt(i*3+j,matrix);crowns.setColorAt(i*3+j,new THREE.Color().setHSL(.31+t.type*.025,.19,.55-j*.045));}});
 const rocks=[],shrubs=[];for(let i=0;i<450;i++){const p=points[Math.floor(random()*points.length)],a=random()*Math.PI*2,d=9+random()*17,x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d,n=nearest(x,z);if(Math.hypot(x-n.x,z-n.z)<8.8)continue;(i%3?shrubs:rocks).push({x,z,s:.3+random()*1.3});}
 for(const [list,g,m] of [[rocks,new THREE.IcosahedronGeometry(1,0),rock],[shrubs,new THREE.IcosahedronGeometry(.75,1),shrub]]){const inst=new THREE.InstancedMesh(g,m,list.length);list.forEach((r,i)=>{q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,random()*6.28);matrix.compose(v.set(r.x,r.s*.25,r.z),q,scale.set(r.s,r.s*.55,r.s*.8));inst.setMatrixAt(i,matrix);});inst.castShadow=true;inst.receiveShadow=true;scene.add(inst);details.push(inst);}
 // Logs and stumps stay on tested land and use shared geometry/materials.
 const logGeo=new THREE.CylinderGeometry(.3,.38,3,8),stumpGeo=new THREE.CylinderGeometry(.45,.6,.65,8);
 for(let i=0;i<trees.length;i+=15){const t=trees[i],log=add(scene,i%2?logGeo:stumpGeo,bark,t.x+2,.4,t.z);if(i%2)log.rotation.z=Math.PI/2;}
 trunks.computeBoundingSphere();crowns.computeBoundingSphere();
 const trunkMatrices=trunks.instanceMatrix.array.slice(),crownMatrices=crowns.instanceMatrix.array.slice(),crownColors=crowns.instanceColor.array.slice();
 return {trees,update(camera,fraction){
  for(const mesh of details)mesh.visible=fraction>.5;
  let count=0;const radius=45+fraction*55;
  for(let i=0;i<trees.length;i++){
   if(Math.hypot(trees[i].x-camera.position.x,trees[i].z-(camera.position.z-35))>radius)continue;
   if(fraction<.6&&i%2)continue;
   for(let k=0;k<16;k++)trunks.instanceMatrix.array[count*16+k]=trunkMatrices[i*16+k];
   for(let k=0;k<48;k++)crowns.instanceMatrix.array[count*48+k]=crownMatrices[i*48+k];
   for(let k=0;k<9;k++)crowns.instanceColor.array[count*9+k]=crownColors[i*9+k];count++;
  }
  trunks.count=count;crowns.count=count*3;trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;crowns.instanceColor.needsUpdate=true;
 }};
}
export function racingBoat(scene){
 const boat=new THREE.Group();scene.add(boat);const paint=make('#e0ef64',.23,.42),metal=make('#9da9aa',.25,.8),rubber=make('#1c292b',.8),seat=make('#2c3739',.65),red=make('#d26033',.3,.3);
 const hull=new THREE.Shape();hull.moveTo(2.35,0);hull.bezierCurveTo(2.05,.35,1.25,.85,.55,.91);hull.lineTo(-1.65,.88);hull.quadraticCurveTo(-2,.86,-2,.52);hull.lineTo(-2,-.52);hull.quadraticCurveTo(-2,-.86,-1.65,-.88);hull.lineTo(.55,-.91);hull.bezierCurveTo(1.25,-.85,2.05,-.35,2.35,0);
 const g=new THREE.ExtrudeGeometry(hull,{depth:.35,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.09,bevelThickness:.12,curveSegments:10});g.rotateX(Math.PI/2);add(boat,g,paint,0,.65);
 add(boat,new THREE.BoxGeometry(2.25,.1,1.35),rubber,-.35,.7);add(boat,new THREE.BoxGeometry(1.15,.18,1.3),paint,1,.75);
 for(const side of [-1,1]){add(boat,new THREE.BoxGeometry(3.3,.09,.06),rubber,-.25,.65,side*.9);add(boat,new THREE.BoxGeometry(.6,.12,.48),seat,.15,.85,side*.35);const back=add(boat,new THREE.BoxGeometry(.12,.62,.5),seat,-.16,1.1,side*.35);back.rotation.z=-.15;}
 add(boat,new THREE.BoxGeometry(.9,.5,.7),metal,-1.1,1.03);for(const side of [-1,1]){const cover=add(boat,new THREE.BoxGeometry(.9,.22,.25),red,-1.08,1.36,side*.32);cover.rotation.x=side*.35;for(let i=0;i<4;i++){const pipe=add(boat,new THREE.TorusGeometry(.13,.045,5,8,Math.PI),metal,-1.45+i*.23,1.12,side*.56);pipe.rotation.y=Math.PI/2;}}
 add(boat,new THREE.CylinderGeometry(.25,.28,.18,12),metal,-1.05,1.57);
 const jet=add(boat,new THREE.CylinderGeometry(.23,.29,.4,12,true),metal,-2.05,.34);jet.rotation.z=Math.PI/2;const nozzle=add(boat,new THREE.CircleGeometry(.19,12),rubber,-2.26,.34);nozzle.rotation.y=-Math.PI/2;
 function tube(a,b){const d=new THREE.Vector3().subVectors(b,a),m=add(boat,new THREE.CylinderGeometry(.05,.05,d.length(),8),metal);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,d.normalize());}
 for(const z of [-.65,.65]){tube(new THREE.Vector3(-.55,.7,z),new THREE.Vector3(-.4,1.8,z));tube(new THREE.Vector3(-.4,1.8,z),new THREE.Vector3(.75,1.7,z));tube(new THREE.Vector3(.75,1.7,z),new THREE.Vector3(1,.7,z));}tube(new THREE.Vector3(-.4,1.8,-.65),new THREE.Vector3(-.4,1.8,.65));
 // Both crew members face local +X and share the hull's bank/heading transform.
 const navigatorHelmet=make('#f0e9d3',.32,.1);
 const crew=[];
 for(const [role,z,helmet,jacket] of [['driver',-.35,red,paint],['navigator',.35,navigatorHelmet,red]]){
  const x=.15;crew.push({role,x,z,helmetY:1.57});
  add(boat,new THREE.BoxGeometry(.27,.36,.28),rubber,x,1.18,z);
  add(boat,new THREE.BoxGeometry(.12,.3,.31),jacket,x+.12,1.2,z);
  add(boat,new THREE.BoxGeometry(.08,.32,.08),jacket,x-.04,1.22,z-.14);
  add(boat,new THREE.BoxGeometry(.08,.32,.08),jacket,x-.04,1.22,z+.14);
  add(boat,new THREE.CylinderGeometry(.07,.07,.1,7),rubber,x,1.41,z);
  add(boat,new THREE.SphereGeometry(.18,12,9),helmet,x,1.57,z);
  const visor=add(boat,new THREE.SphereGeometry(.15,10,7),rubber,x+.095,1.58,z);visor.scale.set(.7,.43,.98);
  for(const side of [-1,1]){
   // Seated thighs, bent knees, and boots below the dashboard.
   add(boat,new THREE.BoxGeometry(.32,.12,.1),rubber,x+.13,.94,z+side*.09);
   add(boat,new THREE.BoxGeometry(.12,.22,.1),rubber,x+.33,.87,z+side*.09);
   add(boat,new THREE.BoxGeometry(.19,.09,.12),rubber,x+.38,.77,z+side*.09);
   const shoulder=new THREE.Vector3(x+.03,1.32,z+side*.17),elbow=new THREE.Vector3(x+.23,1.12,z+side*.2),hand=new THREE.Vector3(x+.43,1.17,z+side*.12);
   for(const [a,b] of [[shoulder,elbow],[elbow,hand]]){const d=new THREE.Vector3().subVectors(b,a),arm=add(boat,new THREE.CylinderGeometry(.045,.05,d.length(),6),rubber);arm.position.copy(a).add(b).multiplyScalar(.5);arm.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP,d.normalize());}
   add(boat,new THREE.SphereGeometry(.06,7,5),helmet,hand.x,hand.y,hand.z);
  }
 }
 const wheel=add(boat,new THREE.TorusGeometry(.16,.026,6,12),metal,.62,1.17,-.35);wheel.rotation.y=Math.PI/2;
 boat.userData.crew=crew;
 // Static boat parts share a handful of draw calls; physics animates the group.
 const batches=new Map();boat.updateMatrixWorld(true);
 for(const child of boat.children){if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push((child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix));}
 boat.clear();for(const [material,list] of batches){const geometry=mergeGeometries(list);for(const g of list)g.dispose();add(boat,geometry,material);}
 return boat;
}
