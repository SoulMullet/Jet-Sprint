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
