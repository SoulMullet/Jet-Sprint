import * as THREE from 'three';
// Every stamp starts at the stern and extends only backwards in hull space.
export function stern(boat,out){out.x=boat.x-Math.cos(boat.angle)*2.35;out.z=boat.z-Math.sin(boat.angle)*2.35;return out;}
const foamNoise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}`;
export class WakeTrail {
 constructor(scene,count=96){
  this.count=count;this.cursor=0;this.clock=0;this.age=new Float32Array(count);this.age.fill(10);this.x=new Float32Array(count);this.z=new Float32Array(count);this.heading=new Float32Array(count);this.fade=new Float32Array(count);
  this.positions=new Float32Array(count*6);this.uv=new Float32Array(count*4);this.vertexFade=new Float32Array(count*2);
  const indices=[];for(let i=0;i<count-1;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('uv',new THREE.BufferAttribute(this.uv,2).setUsage(THREE.DynamicDrawUsage));g.setAttribute('wakeFade',new THREE.BufferAttribute(this.vertexFade,1).setUsage(THREE.DynamicDrawUsage));g.setIndex(indices);g.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:`attribute float wakeFade;varying vec2 st;varying float fade;void main(){st=uv;fade=wakeFade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:foamNoise+`varying vec2 st;varying float fade;void main(){float edge=1.-smoothstep(.45,1.,abs(st.y-.5)*2.);float n=foamNoise(st*vec2(3.,5.))*.6+foamNoise(st*vec2(11.,14.))*.4;float a=smoothstep(.25,.72,n)*edge*fade;if(a<.005)discard;gl_FragColor=vec4(.87,.97,.94,a);}`}));this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=1;scene.add(this.mesh);this.origin={x:0,z:0};
 }
 reset(){this.mesh.visible=false;this.age.fill(10);this.fade.fill(0);this.mesh.geometry.setDrawRange(0,0);}
 update(dt,boat,speed,persistence,intensity){
  this.persistence=persistence;this.clock+=dt;if(speed>1&&this.clock>.085&&intensity>0){this.clock=0;const i=this.cursor++%this.count;stern(boat,this.origin);this.x[i]=this.origin.x;this.z[i]=this.origin.z;this.heading[i]=boat.angle;this.age[i]=0;}
  for(let i=0;i<this.count;i++){this.age[i]+=dt;this.fade[i]=Math.max(0,1-this.age[i]/persistence)*intensity*.6;}
  let rows=0;
  for(let row=0;row<this.count;row++){
   const i=(this.cursor-1-row+this.count*2)%this.count;if(this.fade[i]<=.001)break;
   const width=.2+this.age[i]*.7,nx=-Math.sin(this.heading[i]),nz=Math.cos(this.heading[i]);
   for(let side=0;side<2;side++){const sign=side?1:-1,v=row*2+side;this.positions[v*3]=this.x[i]+nx*width*sign;this.positions[v*3+1]=.03;this.positions[v*3+2]=this.z[i]+nz*width*sign;this.uv[v*2]=this.age[i]*3;this.uv[v*2+1]=side;this.vertexFade[v]=this.fade[i];}rows++;
  }
  this.mesh.visible=rows>1;this.mesh.geometry.setDrawRange(0,Math.max(0,rows-1)*6);this.mesh.geometry.attributes.position.needsUpdate=true;this.mesh.geometry.attributes.uv.needsUpdate=true;this.mesh.geometry.attributes.wakeFade.needsUpdate=true;
 }
}

// A small curved spray sheet supplies the dense core; pooled droplets supply mist.
// t runs aft from the stern, so no part is emitted in front of the hull.
export class RoosterCore {
 constructor(scene){
  const p=[],uv=[],idx=[];for(let i=0;i<=20;i++)for(const side of [-1,1]){p.push(i/20,0,side);uv.push(i/20,(side+1)/2);if(i<20&&side===-1){const j=i*2;idx.push(j,j+1,j+2,j+1,j+3,j+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  this.uniforms={plumeLength:{value:8},plumeHeight:{value:3},spread:{value:1},bend:{value:0},strength:{value:1},time:{value:0}};
  this.mesh=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:this.uniforms,vertexShader:`uniform float plumeLength,plumeHeight,spread,bend;varying vec2 st;void main(){st=uv;float t=position.x;vec3 p=vec3(-2.35-t*plumeLength,.35+4.*plumeHeight*t*(1.-t),position.z*(.12+t*spread)+bend*t*t);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:foamNoise+`uniform float strength,time;varying vec2 st;void main(){float side=abs(st.y-.5)*2.;float edge=1.-smoothstep(.3,1.,side);float n=foamNoise(vec2(st.x*24.-time*4.,st.y*12.+time))*.65+foamNoise(st*vec2(53.,21.))*.35;float a=edge*smoothstep(0.,.08,st.x)*(1.-smoothstep(.65,1.,st.x))*(.45+.55*n)*.5*strength;if(a<.005)discard;gl_FragColor=vec4(.94,.99,1.,a);}`}));this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=2;scene.add(this.mesh);
 }
 update(b,dt,speed,input,density,distance,volume,time){
  const force=Math.min(1.3,((b.pump||0)*.4+speed/24*.7))*density*volume;this.mesh.visible=force>.02&&distance>0;
  this.uniforms.plumeLength.value=(5+speed*.4)*distance;this.uniforms.plumeHeight.value=1+speed*.105;this.uniforms.spread.value=.6+speed*.04;this.uniforms.bend.value=-(b.nozzle||0)*4+(-b.vx*Math.sin(b.angle)+b.vz*Math.cos(b.angle))*.08;this.uniforms.strength.value=force;this.uniforms.time.value=time;
  this.mesh.position.set(b.x,0,b.z);this.mesh.rotation.y=-b.angle;
 }
}
