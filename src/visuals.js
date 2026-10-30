import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {landGeometry} from './track.js';
import {inSceneryClearing} from './venue-layout.js';
import {pineCrown} from './summer-geometry.js';
import {waterUniforms,finishSummerWater} from './summer-water.js';
import {channel} from './physics.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {boatDetail} from './hf-boat-details.js';
const make=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function add(parent,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function texture(draw,size=256){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
export function lighting(scene,renderer){
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene.background=new THREE.Color('#c4d5d1');scene.fog=new THREE.Fog('#c4d5d1',105,240);
 scene.add(new THREE.HemisphereLight(0xb6d1db,0x3d5033,1.45));const sun=new THREE.DirectionalLight(0xffd09a,3.4);sun.position.set(-35,65,25);sun.castShadow=true;sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=160;sun.shadow.bias=-.0003;sun.shadow.normalBias=.08;scene.add(sun,sun.target);
 const dome=new Sky();dome.scale.setScalar(450);dome.renderOrder=-10;dome.material.uniforms.turbidity.value=2;dome.material.uniforms.rayleigh.value=2.3;dome.material.uniforms.mieCoefficient.value=.003;scene.add(dome);scene.environmentIntensity=.28;
 const reflectionSky=new Sky(),skyScene=new THREE.Scene();reflectionSky.scale.setScalar(450);reflectionSky.material=dome.material;skyScene.add(reflectionSky);const pmrem=new THREE.PMREMGenerator(renderer);let environment=null,lastElevation=-1;
 sun.userData.updateSky=elevation=>{if(elevation===lastElevation)return;lastElevation=elevation;const a=elevation*Math.PI/180;dome.material.uniforms.sunPosition.value.set(-70*Math.cos(a),90*Math.sin(a),45*Math.cos(a)).normalize();const next=pmrem.fromScene(skyScene,.04,.1,600);environment?.dispose();environment=next;scene.environment=next.texture;};sun.userData.updateSky(35);sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;
 return sun;
}
export function waterMaterial(points,width,time,boat,strength){
 const depth=texture((ctx,n)=>{ctx.fillStyle='#000';ctx.fillRect(0,0,n,n);ctx.lineJoin='round';ctx.lineCap='round';for(let i=0;i<24;i++){const f=i/24;ctx.strokeStyle=`rgb(${Math.round(30+f*225)},${Math.round(30+f*225)},${Math.round(30+f*225)})`;for(const path of points.paths||[points]){ctx.lineWidth=(path.waterWidth??width)*2*(1-f)*n/250;ctx.beginPath();for(let j=0;j<path.length+(points.paths?0:1);j++){const p=path[j%path.length];j?ctx.lineTo((p.x+125)*n/250,(p.z+125)*n/250):ctx.moveTo((p.x+125)*n/250,(p.z+125)*n/250);}ctx.stroke();}}},512);depth.colorSpace=THREE.NoColorSpace;depth.flipY=false;
 const quality={value:1},m=new THREE.MeshPhysicalMaterial({color:'#258f91',roughness:.16,metalness:.06,clearcoat:.5,clearcoatRoughness:.18,transparent:true,opacity:.88});m.envMapIntensity=1.1;
 const uniforms={...waterUniforms(time),summerDepth:{value:depth},summerBoat:boat,summerStrength:strength};
 finishSummerWater(m,uniforms);return {material:m,quality,uniforms};
}
export function terrain(scene,points,nearest,random,network=null){
 const tex=texture((ctx,n)=>{ctx.fillStyle='#71865a';ctx.fillRect(0,0,n,n);for(let i=0;i<60000;i++){ctx.fillStyle=i%3?'#53604455':'#a2987555';ctx.fillRect(random()*n,random()*n,1,1+random()*3);}},512);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(16,14);
 const ground=make('#a0c77f');ground.map=tex;ground.bumpMap=tex;ground.bumpScale=.035;const geo=network?landGeometry(network,channel.bank):new THREE.PlaneGeometry(250,220,90,80);
 if(!network){geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),p=nearest(x,z),d=Math.hypot(x-p.x,z-p.z);pos.setY(i,-.21-1.3*Math.max(0,1-(d/7.3)**2)+Math.max(0,Math.min(1,(d-10)/12))*(.5+Math.sin(x*.1)*Math.cos(z*.13)*1.4));}geo.computeVertexNormals();}add(scene,geo,ground);
 // Paint a softly edged dirt access path directly on the existing terrain.
 const access=new THREE.CatmullRomCurve3([new THREE.Vector3(-70,0,-42),new THREE.Vector3(-54,0,-45),new THREE.Vector3(-35,0,-41),new THREE.Vector3(-21,0,-39)]).getPoints(16).map(p=>new THREE.Vector2(p.x,p.z));
 ground.onBeforeCompile=shader=>{shader.uniforms.accessPath={value:access};shader.vertexShader='varying vec2 grassWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngrassWorld=position.xz;');shader.fragmentShader='varying vec2 grassWorld;uniform vec2 accessPath[17];\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float road=1000.;for(int i=0;i<16;i++){vec2 a=accessPath[i],b=accessPath[i+1],v=b-a;float t=clamp(dot(grassWorld-a,v)/dot(v,v),0.,1.);road=min(road,length(grassWorld-a-v*t));}
 float path=1.-smoothstep(1.0,1.7,road);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.31,.25,.15),path*.8);`);};
 const bark=make('#534a3b'),leaf=make('#9fc398'),rock=make('#75776c'),shrub=make('#647447');
 leaf.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 needleWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 #ifdef USE_INSTANCING
 needleWorld=(instanceMatrix*vec4(position,1.)).xyz;
 #else
 needleWorld=position;
 #endif
 `);shader.fragmentShader='varying vec3 needleWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float needleDetail=sin(dot(needleWorld,vec3(43.8,39.1,37.3)))*sin(needleWorld.y*71.6+cos(needleWorld.x*27.1));
 float needleLod=1.-smoothstep(.025,.13,length(fwidth(needleWorld)));diffuseColor.rgb*=.9+needleDetail*.13*needleLod;`);};
 const trees=[],details=[],matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),v=new THREE.Vector3();
 for(let i=0;i<360;i++){const x=(random()-.5)*238,z=(random()-.5)*206,p=nearest(x,z);if(Math.hypot(x-p.x,z-p.z)>(p.waterWidth??9)+4&&!inSceneryClearing(x,z,2))trees.push({x,z,size:1+random()*1.4,type:i%3,rotation:random()*6.28});}
 // Riparian stands conceal the next bend and the destination's preparation.
 for(const path of network?.paths||[])if(path.waterWidth<9)for(let i=4;i<path.length-1;i+=10){
  const p=path[i],q=path[i+1],length=Math.hypot(q.x-p.x,q.z-p.z),nx=-(q.z-p.z)/length,nz=(q.x-p.x)/length;
  for(const side of [-1,1]){const d=path.waterWidth+5+random()*3,x=p.x+nx*side*d,z=p.z+nz*side*d,n=nearest(x,z);if(Math.hypot(x-n.x,z-n.z)>(n.waterWidth??9)+2&&!inSceneryClearing(x,z,2))trees.push({x,z,size:1+random()*.8,type:1,rotation:random()*6.28});}
 }
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.32,5,7),bark,trees.length);const crowns=new THREE.InstancedMesh(pineCrown(),leaf,trees.length*3);scene.add(trunks,crowns);trunks.castShadow=crowns.castShadow=true;trunks.receiveShadow=crowns.receiveShadow=true;
 trees.forEach((t,i)=>{q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,t.rotation);matrix.compose(v.set(t.x,2.2*t.size,t.z),q,scale.set(1,t.size,1));trunks.setMatrixAt(i,matrix);for(let j=0;j<3;j++){const taper=1-j*.22;matrix.compose(v.set(t.x,(3+j*1.4)*t.size,t.z),q,scale.set(t.size*taper*(t.type===1?.8:1),t.size*(t.type===2?.8:1),t.size*taper));crowns.setMatrixAt(i*3+j,matrix);crowns.setColorAt(i*3+j,new THREE.Color().setHSL(.32+t.type*.02,.35,.19-j*.012));}});
 const rocks=[],shrubs=[];for(let i=0;i<450;i++){const p=points[Math.floor(random()*points.length)],a=random()*Math.PI*2,d=9+random()*17,x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d,n=nearest(x,z);if(Math.hypot(x-n.x,z-n.z)<10.2||inSceneryClearing(x,z,1))continue;(i%3?shrubs:rocks).push({x,z,s:.3+random()*1.3});}
 for(const [list,g,m] of [[rocks,new THREE.IcosahedronGeometry(1,1),rock],[shrubs,new THREE.IcosahedronGeometry(.75,2),shrub]]){const inst=new THREE.InstancedMesh(g,m,list.length);list.forEach((r,i)=>{q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,random()*6.28);matrix.compose(v.set(r.x,r.s*.25,r.z),q,scale.set(r.s,r.s*.55,r.s*.8));inst.setMatrixAt(i,matrix);});inst.castShadow=true;inst.receiveShadow=true;scene.add(inst);details.push(inst);}
 // Logs and stumps stay on tested land and use shared geometry/materials.
 const logGeo=new THREE.CylinderGeometry(.3,.38,3,8),stumpGeo=new THREE.CylinderGeometry(.45,.6,.65,8);
 for(let i=0;i<trees.length;i+=15){const t=trees[i],log=add(scene,i%2?logGeo:stumpGeo,bark,t.x+2,.4,t.z);if(i%2)log.rotation.z=Math.PI/2;}
 trunks.computeBoundingSphere();crowns.computeBoundingSphere();
 const trunkMatrices=trunks.instanceMatrix.array.slice(),crownMatrices=crowns.instanceMatrix.array.slice(),crownColors=crowns.instanceColor.array.slice();
 const result={trees,trunks,crowns,ground,details,gradedFloodplain:!!network?.gradedFloodplain,drawDistance:160,visibleTrees:trees.length,update(camera,fraction){
  for(const mesh of details)mesh.visible=fraction>.5;
  let count=0;const radius=Math.min(result.drawDistance,45+fraction*80);
  for(let i=0;i<trees.length;i++){
   if(Math.hypot(trees[i].x-camera.position.x,trees[i].z-(camera.position.z-35))>radius)continue;
   if((i%10)/10>fraction)continue;
   for(let k=0;k<16;k++)trunks.instanceMatrix.array[count*16+k]=trunkMatrices[i*16+k];
   for(let k=0;k<48;k++)crowns.instanceMatrix.array[count*48+k]=crownMatrices[i*48+k];
   for(let k=0;k<9;k++)crowns.instanceColor.array[count*9+k]=crownColors[i*9+k];count++;
  }
  result.visibleTrees=count;trunks.count=count;crowns.count=count*3;trunks.instanceMatrix.needsUpdate=true;crowns.instanceMatrix.needsUpdate=true;crowns.instanceColor.needsUpdate=true;
 }};return result;
}
export function racingBoat(scene,{cockpitLayers=false}={}){
 const boat=new THREE.Group();scene.add(boat);const paint=new THREE.MeshPhysicalMaterial({color:'#e9ed86',roughness:.17,metalness:.04,clearcoat:1,clearcoatRoughness:.14}),metal=make('#9da9aa',.25,.8),rubber=make('#1c292b',.8),seat=make('#2c3739',.65),red=make('#d26033',.3,.3);
 const hull=new THREE.Shape();hull.moveTo(2.35,0);hull.bezierCurveTo(2.05,.35,1.25,.85,.55,.91);hull.lineTo(-1.65,.88);hull.quadraticCurveTo(-2,.86,-2,.52);hull.lineTo(-2,-.52);hull.quadraticCurveTo(-2,-.86,-1.65,-.88);hull.lineTo(.55,-.91);hull.bezierCurveTo(1.25,-.85,2.05,-.35,2.35,0);
 const g=new THREE.ExtrudeGeometry(hull,{depth:.35,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.09,bevelThickness:.12,curveSegments:24});g.rotateX(Math.PI/2);add(boat,g,paint,0,.65);
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
  const crewStart=boat.children.length;
  const x=.15;crew.push({role,x,z,helmetY:1.57});
  add(boat,new THREE.CapsuleGeometry(.135,.15,5,12),rubber,x,1.18,z);
  const vest=add(boat,new THREE.SphereGeometry(1,12,8),jacket,x+.1,1.2,z);vest.scale.set(.105,.18,.17);
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
  if(cockpitLayers&&role==='driver')for(let i=crewStart;i<boat.children.length;i++)boat.children[i].userData.hideInCockpit=true;
 }
 const wheel=add(boat,new THREE.TorusGeometry(.16,.026,6,12),metal,.62,1.17,-.35);wheel.rotation.y=Math.PI/2;
 boat.userData.crew=crew;
 boatDetail(boat,{paint,metal,rubber,seat,red,add});
 // Static boat parts share a handful of draw calls; physics animates the group.
 const batches=new Map();boat.updateMatrixWorld(true);
 for(const child of boat.children){const hidden=!!child.userData.hideInCockpit,key=child.material.uuid+hidden;
  if(!batches.has(key))batches.set(key,{material:child.material,hidden,list:[]});
  batches.get(key).list.push((child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix));
 }
 boat.clear();for(const {material,hidden,list} of batches.values()){const geometry=mergeGeometries(list);for(const g of list)g.dispose();const part=add(boat,geometry,material);if(hidden)part.layers.set(1);}

 return boat;
}
