import * as THREE from 'three';
import {stern} from './wake-trail.js';

// Fixed GPU ballistic pool: one instanced draw for jet streaks, mist and droplets.
// CPU work is proportional to births, not live particles. No objects per birth.
export class HFSpray {
 constructor(scene,uniforms,capacity=6144){
  this.capacity=capacity;this.cursor=0;this.emission=0;this.time=0;this.previousSpeed=0;this.origin={x:0,z:0};this.seed=87;this.water=uniforms;this.history=0;this.wakeClock=0;this.budget=3200;
  const quad=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();g.index=quad.index.clone();g.setAttribute('position',quad.attributes.position.clone());g.setAttribute('uv',quad.attributes.uv.clone());quad.dispose();
  this.births=new Float32Array(capacity*4);this.velocities=new Float32Array(capacity*4);this.styles=new Float32Array(capacity*4);this.births.fill(-1000);
  for(const [name,array] of [['birth',this.births],['launch',this.velocities],['style',this.styles]])g.setAttribute(name,new THREE.InstancedBufferAttribute(array,4).setUsage(THREE.DynamicDrawUsage));
  this.attributes=['birth','launch','style'].map(name=>g.attributes[name]);this.uniforms={clock:{value:0},sunColor:{value:new THREE.Color(1,.98,.92)}};
  const m=new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,vertexShader:`
   attribute vec4 birth,launch,style;uniform float clock,mistQuality;varying vec2 st;varying float fade,kind,ageOut;
   void main(){float age=clock-birth.w,life=style.x;kind=style.z;ageOut=age;st=uv;
    vec3 p=birth.xyz+launch.xyz*age;float drag=kind<.5?.16:kind<1.5?.65:.06;
    p.xz=birth.xz+launch.xz*(1.-exp(-age*drag))/drag;p.y-=4.9*age*age*(kind<1.5?.65:1.);
    p.xz+=sin(vec2(age*3.7,age*2.9)+style.w)*age*.24*(kind<1.5?1.:.1);
    float alive=step(0.,age)*step(age,life)*step(.025,p.y);
    fade=alive*pow(max(0.,1.-age/life),1.3)*smoothstep(0.,.025,age)*(kind<.5?.9:kind<1.5?.12:.85);
    vec4 eye=modelViewMatrix*vec4(p,1.);float size=style.y*(kind<1.5?1.+age*.6:1.);
    vec2 dir=normalize((modelViewMatrix*vec4(launch.xyz-vec3(0.,9.8*age,0.),0.)).xy+vec2(.001));
    vec2 side=vec2(-dir.y,dir.x);eye.xy+=(side*position.x+dir*position.y*(kind<.5?2.4:kind>1.5?1.7:1.))*size;
    gl_Position=projectionMatrix*eye;if(alive<.5)gl_Position=vec4(2.,2.,2.,1.);
   }`,fragmentShader:`uniform vec3 sunColor;varying vec2 st;varying float fade,kind,ageOut;
   void main(){float r=length(st-.5)*2.;if(r>1.||fade<.003)discard;float a=kind>1.5?pow(1.-r*r,.65):pow(1.-r*r,2.);vec3 c=mix(vec3(.57,.72,.73),sunColor,.65+st.y*.3);gl_FragColor=vec4(c,a*fade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  this.mesh=new THREE.Mesh(g,m);this.mesh.frustumCulled=false;this.mesh.renderOrder=3;this.mesh.name='HF GPU jet, mist and ballistic droplets';scene.add(this.mesh);this.reset();
  const p=[],uv=[],idx=[],rings=24,sides=8;for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){p.push(i/rings,j/sides*Math.PI*2,0);uv.push(i/rings,j/sides);if(i<rings&&j<sides){const a=i*(sides+1)+j;idx.push(a,a+1,a+sides+1,a+1,a+sides+2,a+sides+1);}}
  const coreGeometry=new THREE.BufferGeometry();coreGeometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));coreGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));coreGeometry.setIndex(idx);
  this.coreUniforms={...this.uniforms,jetLength:{value:8},jetHeight:{value:2},jetOutletY:{value:.44},bend:{value:0},force:{value:0}};
  this.core=new THREE.Mesh(coreGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,uniforms:this.coreUniforms,
   vertexShader:`uniform float jetLength,jetHeight,jetOutletY,bend,clock;varying vec2 st;void main(){st=uv;float t=position.x,a=position.y,r=(.025+t*.44)*(1.+sin(a*3.+t*49.-clock*18.)*.15);vec3 p=vec3(-2.35-t*jetLength,jetOutletY+4.*jetHeight*t*(1.-t)+sin(a)*r,cos(a)*r+bend*t*t);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
   fragmentShader:`uniform float force,clock;varying vec2 st;void main(){float filaments=.5+.5*sin(st.y*50.+sin(st.x*19.-clock*11.)*2.);float breakup=.5+.5*sin(st.x*137.-clock*31.+st.y*29.);float fade=(1.-smoothstep(.6,1.,st.x))*smoothstep(0.,.025,st.x);float alpha=fade*(.3+filaments*.4)*(.4+breakup*.6)*force;if(alpha<.01)discard;gl_FragColor=vec4(vec3(.88,.96,.95)*(1.+filaments*.16),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}));this.core.frustumCulled=false;this.core.renderOrder=2;this.core.visible=false;this.core.name='HF volumetric near-outlet jet filaments';this.mesh.add(this.core);
 }
 random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
 configure(limit,quality){this.budget=Math.max(128,Math.min(this.capacity,Math.round(limit)));this.mesh.geometry.instanceCount=this.budget;this.quality=quality;}
 reset(){this.births?.fill(-1000);this.cursor=this.emission=this.previousSpeed=0;this.rate=0;this.wakeClock=0;this.history=0;if(this.core)this.core.visible=false;for(const w of this.water.hfWake.value)w.set(0,0,100,0);if(this.mesh){this.mesh.geometry.attributes.birth.clearUpdateRanges();this.mesh.geometry.attributes.birth.needsUpdate=true;}}
 update(dt,b,speed,input,{density=1,distance=1,volume=1,effects=1,persistence=3,outletY=.44,impact=0}={}){
  this.time+=dt;this.uniforms.clock.value=this.time;
  const fx=Math.cos(b.angle),fz=Math.sin(b.angle),slip=-b.vx*fz+b.vz*fx,accel=Math.max(0,(speed-this.previousSpeed)/Math.max(.01,dt)),pump=b.pump||0,yaw=b.yawRate||0;
  this.previousSpeed=speed;stern(b,this.origin);
  // Wake is laid down at the jet outlet in world space. It remains there on turns/reverse.
  const wakes=this.water.hfWake.value;for(const w of wakes)w.z+=dt*5/persistence;
  this.wakeClock+=dt;const strength=Math.min(1.2,speed/20)*volume;
  if(speed>1&&this.wakeClock>.11){this.wakeClock=0;wakes[this.history++%24].set(this.origin.x,this.origin.z,0,strength);}
  const moving=THREE.MathUtils.smoothstep(speed,.7,5),force=(speed/24+Math.abs(slip)*.025+Math.abs(yaw)*.12+Math.min(10,accel)*.012)*moving;
  const jet=Number.isFinite(b.jetPower)?Math.min(1.6,b.jetPower):pump;
  this.core.visible=distance>0&&force*jet*density*volume*effects>.015;this.core.position.set(b.x,0,b.z);this.core.rotation.y=-b.angle;this.coreUniforms.jetOutletY.value=outletY;this.coreUniforms.jetLength.value=(4+speed*.3)*distance;this.coreUniforms.jetHeight.value=(.7+speed*.12)*Math.min(1.4,Math.sqrt(jet));this.coreUniforms.bend.value=-yaw*1.4-(b.nozzle||0)*2.5+slip*.16;this.coreUniforms.force.value=Math.min(1,force*jet*density*volume*effects*.9);
  const hullSpray=Math.abs(b.lateralAcceleration||0)*12*moving+impact*600;
  this.rate=Math.min(5000,((1100*force+650*pump*moving)*jet+hullSpray)*density*volume*effects*this.quality)*(distance>0?1:0);
  this.emission+=this.rate*dt;
  // Long background pauses cannot cause an unbounded allocation/emission burst.
  this.emission=Math.min(this.emission,this.budget);
  const firstBirth=this.cursor%this.budget;let born=0;
  while(this.emission>=1){this.emission--;born++;const i=this.cursor++%this.budget,j=i*4,r=this.random(),kind=r<.42?0:r<.78?1:2;
   const side=(this.random()-.5)*(1+Math.abs(slip)*.16),deflect=-(b.nozzle||0)*2.7-yaw*.9+slip*.25;
   const jet=(8+speed*.6+pump*4)*(kind===1?.75:1)*distance*(.7+this.random()*.55);
   let x=this.origin.x,z=this.origin.z,y=outletY;
   // The occasional hull sheet starts at an aft chine, safely behind the cockpit.
   if(kind===2&&Math.abs(slip)>3&&this.random()<.35){x+=-fz*Math.sign(slip)*.75;z+=fx*Math.sign(slip)*.75;}
   this.births[j]=x;this.births[j+1]=y;this.births[j+2]=z;this.births[j+3]=this.time;
   this.velocities[j]=b.vx*.55-fx*jet-fz*(side+deflect);this.velocities[j+1]=(4.5+speed*.23)*(kind===1?1.1:1)*(.65+this.random()*.6);this.velocities[j+2]=b.vz*.55-fz*jet+fx*(side+deflect);this.velocities[j+3]=0;
   this.styles[j]=kind===1?1.6+this.random()*.6:2;this.styles[j+1]=kind===0?.2+this.random()*.21:kind===1?.23+this.random()*.28:.035+this.random()*.08;this.styles[j+2]=kind;this.styles[j+3]=this.random()*6.28;
  }
  if(born>0)for(const attribute of this.attributes){attribute.clearUpdateRanges();const first=Math.min(born,this.budget-firstBirth);attribute.addUpdateRange(firstBirth*4,first*4);if(first<born)attribute.addUpdateRange(0,(born-first)*4);attribute.needsUpdate=true;}
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.core.geometry.dispose();this.core.material.dispose();}
}
