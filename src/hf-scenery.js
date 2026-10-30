import * as THREE from 'three';
import {inSceneryClearing} from './venue-layout.js';

export function firGeometry(layers=11,rays=8){
 const p=[],uv=[],idx=[];
 for(let layer=0;layer<layers;layer++)for(let ray=0;ray<rays;ray++){
  const t=layer/layers,a=ray/rays*Math.PI*2+layer*2.4,length=(1-t)**.7*(2.4+.25*Math.sin(ray*7+layer)),y=1.8+t*7;
  for(let cross=0;cross<3;cross++){
   const tilt=cross*Math.PI/3,width=length*.48,sx=Math.cos(a)*.06,sz=Math.sin(a)*.06,ex=Math.cos(a)*length,ez=Math.sin(a)*length,wy=Math.sin(tilt)*width,wx=-Math.sin(a)*width*Math.cos(tilt),wz=Math.cos(a)*width*Math.cos(tilt),tipY=y-.25+Math.sin(ray*4.1+layer)*.17;
   const base=p.length/3;p.push(sx-wx,y-wy,sz-wz,sx+wx,y+wy,sz+wz,ex+wx*.2,tipY+wy*.2,ez+wz*.2,ex-wx*.2,tipY-wy*.2,ez-wz*.2);uv.push(0,0,0,1,1,1,1,0);idx.push(base,base+1,base+2,base,base+2,base+3);
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function needleTexture(){
 const w=256,h=128,data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/(w-1),v=y/(h-1)*2-1,stem=Math.abs(v)<.018,feather=Math.abs(v)<Math.sin(u*Math.PI)**.6*.87;
  const needle=Math.abs(Math.sin(u*145+Math.abs(v)*27))>.43,alpha=stem||feather&&needle;
  const i=(y*w+x)*4,c=.8+.2*Math.sin(x*.73+y*.91);data[i]=210*c;data[i+1]=235*c;data[i+2]=182*c;data[i+3]=alpha?255:0;
 }
 const t=new THREE.DataTexture(data,w,h);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
const groundNoise=`float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.)),f.x),f.y);}`;
function groundFinish(material,uniforms,bank=false){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{previous?.(shader);Object.assign(shader.uniforms,{hfGroundTime:uniforms.summerTime});shader.vertexShader='varying vec3 hfLand;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhfLand=position;');shader.fragmentShader='varying vec3 hfLand;uniform float hfGroundTime;\n'+groundNoise+'\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float mottling=groundNoise(hfLand.xz*.23)*.6+groundNoise(hfLand.xz*.89)*.4;
   float grain=groundNoise(hfLand.xz*24.);diffuseColor.rgb*=.7+mottling*.55;
   diffuseColor.rgb=mix(diffuseColor.rgb,${bank?'vec3(.16,.145,.095)':'vec3(.18,.19,.095)'},smoothstep(.58,.76,mottling)*${bank?'.4':'.28'});
   diffuseColor.rgb*=.92+grain*.16;
  `);};material.customProgramCacheKey=()=>bank?'hf-wet-gravel-v2':'hf-grass-soil-v2';
}
export class HFScenery {
 constructor(scene,environment,shore,nearest,uniforms){
  Object.assign(this,{scene,environment,nearest,uniforms});this.clock=1;this.elapsed=0;this.density=1;this.distance=160;this.detail=2;
  const texture=needleTexture(),leaf=new THREE.MeshStandardMaterial({map:texture,color:'#7b9a6b',roughness:.9,alphaTest:.45,alphaToCoverage:true,side:THREE.DoubleSide});
  const wind=shader=>{shader.uniforms.hfTime=uniforms.summerTime;shader.vertexShader='uniform float hfTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed.x+=sin(hfTime*1.3+position.y*.8+instanceMatrix[3].x*.3)*.025*position.y;`);};leaf.onBeforeCompile=wind;leaf.customProgramCacheKey=()=> 'HF fir wind';
  this.near=new THREE.InstancedMesh(firGeometry(),leaf,environment.trees.length);this.far=new THREE.InstancedMesh(firGeometry(6,6),leaf,environment.trees.length);
  for(const tree of [this.near,this.far]){tree.castShadow=tree.receiveShadow=true;tree.frustumCulled=false;tree.name='HF cutout Douglas fir branches';tree.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:texture,alphaTest:.45,side:THREE.DoubleSide});tree.customDepthMaterial.onBeforeCompile=wind;scene.add(tree);}
  this.trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.15,.29,8,9),environment.trunks.material.clone(),environment.trees.length);this.trunks.castShadow=this.trunks.receiveShadow=true;this.trunks.frustumCulled=false;this.trunks.name='HF fir trunks with matched canopy culling';scene.add(this.trunks);environment.crowns.visible=environment.trunks.visible=false;
  groundFinish(environment.ground,uniforms);groundFinish(shore.material,uniforms,true);
  this.matrix=new THREE.Matrix4();this.position=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.scale=new THREE.Vector3();this.axis=new THREE.Vector3(0,1,0);
  this.grassPositions=[];this.rockPositions=[];let seed=8917;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<6500;i++){
   const x=(random()-.5)*238,z=(random()-.5)*206,p=nearest(x,z),d=Math.hypot(x-p.x,z-p.z),w=p.waterWidth??9;if(d<w+.45||d>w+10||inSceneryClearing(x,z,.8))continue;
   const t=THREE.MathUtils.clamp((d-w-1.1)/12,0,1),height=d<w+1.1?-.06+.41*((d-w)/1.1)**2*(3-2*(d-w)/1.1):(environment.gradedFloodplain ? .35 : .35+t*t*(3-2*t)*(.65+Math.sin(x*.08)*Math.cos(z*.09)*.4));
   const r={x,z,y:height,scale:.4+random()*.8,angle:random()*6.28,reed:d<w+1.8};if(i%9===0)this.rockPositions.push(r);else this.grassPositions.push(r);
  }
  const blade=new THREE.BufferGeometry(),p=[],uv=[],idx=[];
  for(let j=0;j<7;j++){const a=j*2.39996,h=.45+(j%3)*.2,w=.035,dx=Math.cos(a),dz=Math.sin(a),base=p.length/3;p.push(-dx*w,0,-dz*w,dx*w,0,dz*w,dx*.12+dx*w,h*.65,dz*.12+dz*w,dx*.23,h,dz*.23);uv.push(0,0,1,0,1,.6,.5,1);idx.push(base,base+1,base+2,base,base+2,base+3);}
  blade.setAttribute('position',new THREE.Float32BufferAttribute(p,3));blade.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));blade.setIndex(idx);blade.computeVertexNormals();
  const grassMaterial=new THREE.MeshStandardMaterial({color:'#727b36',roughness:.95,side:THREE.DoubleSide});grassMaterial.onBeforeCompile=shader=>{shader.uniforms.hfTime=uniforms.summerTime;shader.vertexShader='uniform float hfTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed.x+=sin(hfTime*1.7+instanceMatrix[3].x*.7+instanceMatrix[3].z*.5)*position.y*position.y*.12;`);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=.7+vNormal.y*.1;`);};
  this.grass=new THREE.InstancedMesh(blade,grassMaterial,this.grassPositions.length);this.grass.frustumCulled=false;this.grass.receiveShadow=true;scene.add(this.grass);
  this.rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:'#898b7b',roughness:.65}),this.rockPositions.length);this.rocks.castShadow=this.rocks.receiveShadow=true;this.rocks.frustumCulled=false;scene.add(this.rocks);
  this.meshes=[this.near,this.far,this.trunks,this.grass,this.rocks];this.color=new THREE.Color();
 }
 configure(values,detail){this.density=values.vegetation;this.distance=values.drawDistance;this.detail=detail;this.clock=1;}
 place(mesh,index,x,y,z,size,angle,sy=size){this.matrix.compose(this.position.set(x,y,z),this.rotation.setFromAxisAngle(this.axis,angle),this.scale.set(size,sy,size));mesh.setMatrixAt(index,this.matrix);}
 update(dt,target){
  this.elapsed+=dt;this.clock+=dt;if(this.clock<.35)return;this.clock=0;this.environment.crowns.visible=this.environment.trunks.visible=false;
  let near=0,far=0,trunks=0;
  for(let i=0;i<this.environment.trees.length;i++){const t=this.environment.trees[i],d=Math.hypot(t.x-target.x,t.z-target.z);if(d>this.distance||(i%17)/17>this.density)continue;const close=d<(this.detail>=2?65:38),mesh=close?this.near:this.far,index=close?near++:far++;this.place(mesh,index,t.x,.5,t.z,t.size*.88,t.rotation);this.place(this.trunks,trunks++,t.x,.5+3.7*t.size*.88,t.z,t.size*.88,t.rotation);mesh.setColorAt(index,this.color.setHSL(.29+(i%5)*.008,.24,.24+(i%4)*.018));}
  this.near.count=near;this.far.count=far;
  this.trunks.count=trunks;this.trunks.instanceMatrix.needsUpdate=true;
  for(const mesh of [this.near,this.far]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  for(const [mesh,list,isGrass] of [[this.grass,this.grassPositions,true],[this.rocks,this.rockPositions,false]]){
   let n=0;const radius=isGrass?(this.detail>=2?52:26):this.distance;
   for(let i=0;i<list.length;i++){const p=list[i];if(Math.hypot(p.x-target.x,p.z-target.z)>radius||i%10/10>this.density*(isGrass?.9:1))continue;const s=p.scale*(isGrass?1:.35);this.place(mesh,n++,p.x,p.y+(isGrass?0:s*.2),p.z,s,p.angle,isGrass?s*(p.reed?1.9:1):s*.65);}
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
  }
 }
 inspect(){return {nearTrees:this.near.count,farTrees:this.far.count,grassClumps:this.grass.count,shoreRocks:this.rocks.count};}
 dispose(){const materials=new Set();for(const m of this.meshes){m.removeFromParent();m.geometry.dispose();materials.add(m.material);m.customDepthMaterial?.dispose();}for(const m of materials){m.map?.dispose();m.dispose();}}
}
