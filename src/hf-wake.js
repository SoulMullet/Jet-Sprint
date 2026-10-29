import * as THREE from 'three';
import {stern} from './wake-trail.js';
const ribbonCoordinates=[-1,-.4,-.24,.24,.4,1];

// Three connected foam ribbons: jet churn plus separated, widening chine wakes.
// All samples are historical world positions, so drift never rotates the trail.
export class HFWake {
 constructor(scene,uniforms,count=192){
  this.count=count;this.cursor=0;this.clock=0;this.origin={x:0,z:0};this.samples=new Float32Array(count*5);this.samples.fill(100);this.positions=new Float32Array(count*18);this.uv=new Float32Array(count*12);this.fade=new Float32Array(count*6);
  const g=new THREE.BufferGeometry(),idx=[];for(let row=0;row<count-1;row++)for(let band=0;band<3;band++){const a=row*6+band*2,b=a+6;idx.push(a,a+1,b,a+1,b+1,b);}
  g.setIndex(idx);for(const [name,array,size] of [['position',this.positions,3],['uv',this.uv,2],['foamFade',this.fade,1]])g.setAttribute(name,new THREE.BufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{clock:uniforms.summerTime,waveHeight:uniforms.summerWaves},vertexShader:`uniform float clock,waveHeight;attribute float foamFade;varying vec2 st,world;varying float fade;
   void main(){st=uv;world=position.xz;fade=foamFade;vec3 p=position;p.y+=sin(dot(p.xz,vec2(.48,.23))+clock*1.15)*.04*waveHeight;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
   fragmentShader:`uniform float clock;varying vec2 st,world;varying float fade;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    void main(){float n=noise(world*2.1+clock*.08)*.6+noise(world*7.7-clock*.13)*.4;float edge=pow(1.-abs(st.y-.5)*2.,.5);float bubbles=smoothstep(.3,.68,n);float a=fade*edge*bubbles;if(a<.005)discard;gl_FragColor=vec4(mix(vec3(.54,.72,.68),vec3(.92,.97,.9),n),a);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`}));this.mesh.frustumCulled=false;this.mesh.renderOrder=1;this.mesh.name='HF persistent three-band turbulent foam';scene.add(this.mesh);this.reset();
 }
 reset(){for(let i=0;i<this.count;i++)this.samples[i*5+3]=100;this.cursor=0;this.clock=0;this.mesh.visible=false;this.mesh.geometry.setDrawRange(0,0);}
 update(dt,b,speed,persistence,volume){
  this.clock+=dt;const s=this.samples;for(let i=0;i<this.count;i++)s[i*5+3]+=dt;
  if(speed>.8&&this.clock>.04){this.clock=0;const j=(this.cursor++%this.count)*5;stern(b,this.origin);s[j]=this.origin.x;s[j+1]=this.origin.z;s[j+2]=b.angle;s[j+3]=0;s[j+4]=Math.min(1,speed/16)*Math.min(1.5,volume);}
  let rows=0;const coords=ribbonCoordinates;
  for(let row=0;row<this.count;row++){
   const j=((this.cursor-1-row+this.count*2)%this.count)*5,age=s[j+3];if(age>=persistence)break;
   const width=.24+age*(.85+s[j+4]*.25),nx=-Math.sin(s[j+2]),nz=Math.cos(s[j+2]);
   for(let k=0;k<6;k++){const v=row*6+k,d=coords[k]*width;this.positions[v*3]=s[j]+nx*d;this.positions[v*3+1]=.047;this.positions[v*3+2]=s[j+1]+nz*d;this.uv[v*2]=age;this.uv[v*2+1]=k%2;this.fade[v]=s[j+4]*(1-age/persistence)**1.4*(k===2||k===3?.8:.45);}
   rows++;
  }
  this.mesh.visible=rows>1&&volume>0;this.mesh.geometry.setDrawRange(0,Math.max(0,rows-1)*18);for(const name of ['position','uv','foamFade'])this.mesh.geometry.attributes[name].needsUpdate=true;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
