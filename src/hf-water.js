import * as THREE from 'three';

// Seeded, mipmapped normal field generated once. No downloads or texture seams.
export function waterNormalTexture(size=256){
 const data=new Uint8Array(size*size*4),height=new Float32Array(size*size);
 const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 const noise=(x,y,period)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),h=(a,b)=>hash((a+period)%period,(b+period)%period);return (h(ix,iy)*(1-u)+h(ix+1,iy)*u)*(1-v)+(h(ix,iy+1)*(1-u)+h(ix+1,iy+1)*u)*v;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let h=0;for(let o=0;o<5;o++){const f=4*2**o;h+=noise(x/size*f,y/size*f,f)*2**(-o);}height[y*size+x]=h;}
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size])*6,dz=(height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x])*6,l=Math.hypot(dx,1,dz),i=(y*size+x)*4;data[i]=(-dx/l*.5+.5)*255;data[i+1]=(1/l*.5+.5)*255;data[i+2]=(-dz/l*.5+.5)*255;data[i+3]=255;}
 const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}
export function hfWaterUniforms(){return {hfEnabled:{value:1},hfDetail:{value:2},hfNormal:{value:waterNormalTexture()},hfReflection:{value:null},hfReflectionMatrix:{value:new THREE.Matrix4()},hfReflectionActive:{value:0},hfReflectionStrength:{value:1},hfWake:{value:Array.from({length:24},()=>new THREE.Vector4(0,0,100,0))}};}

const common=`
uniform float hfEnabled,hfDetail;
uniform vec4 hfWake[24];
float hfHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float hfNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hfHash(i),hfHash(i+vec2(1.,0.)),f.x),mix(hfHash(i+vec2(0.,1.)),hfHash(i+vec2(1.)),f.x),f.y);}
vec3 hfWaves(vec2 p,float t){
 vec3 w=vec3(0.);
 for(int i=0;i<6;i++){
  if(float(i)>1.+hfDetail*1.5)break;
  float k=float(i),f=.55+k*.51,a=k*2.39996;vec2 d=vec2(cos(a),sin(a));
  float phase=dot(p,d)*f+t*(.75+k*.24),amp=.032/(1.+k*.8);
  w+=vec3(sin(phase),cos(phase)*f*d)*amp;
 }return w;
}
float hfTurbulence(vec2 p){float f=0.;for(int i=0;i<24;i++){
 if(float(i)>3.+hfDetail*7.)break;
 vec4 w=hfWake[i];float age=w.z,r=.6+age*1.2;
 f+=exp(-dot(p-w.xy,p-w.xy)/(r*r))*w.w*max(0.,1.-age/5.);
 }return min(1.,f);}
`;

// Extend the existing PBR material, including its retained fluid solver and debug views.
export function finishHFWater(material,uniforms,{simulated=false}={}){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
  previous(shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=common+'uniform mat4 hfReflectionMatrix;varying vec4 hfReflectCoord;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   if(hfEnabled>.5){vec3 hfW=hfWaves(position.xz,summerTime*summerSpeed);float hfT=hfTurbulence(position.xz);transformed.y+=(hfW.x*summerWaves+sin(length(position.xz-summerBoat.xz)*5.-summerTime*7.)*hfT*.025)*shoreFade;}
   hfReflectCoord=hfReflectionMatrix*vec4(transformed,1.);
   #include <project_vertex>`);
  // summerBoat is shared by the vertex wake displacement and the fragment finish.
  shader.vertexShader='uniform vec3 summerBoat;\n'+shader.vertexShader;
  shader.fragmentShader=common+'uniform sampler2D hfNormal,hfReflection;uniform float hfReflectionActive,hfReflectionStrength;varying vec4 hfReflectCoord;\n'+shader.fragmentShader;
  const guard=simulated?'hfEnabled>.5&&fluidDebug==0':'hfEnabled>.5';
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   if(${guard}){
    float t=summerTime*summerSpeed;vec2 p=summerWorld;
    vec3 n1=texture2D(hfNormal,p*.083+vec2(t*.009,t*.003)).xyz*2.-1.;
    vec2 rotated=mat2(.8,-.6,.6,.8)*p;
    vec3 n2=texture2D(hfNormal,rotated*.151+vec2(-t*.006,t*.011)).xyz*2.-1.;
    vec3 n3=vec3(0.,1.,0.);if(hfDetail>1.5)n3=texture2D(hfNormal,p*.317+vec2(t*.017,-t*.008)).xyz*2.-1.;
    vec3 w=hfWaves(p,t);vec2 slope=(n1.xz*.42+n2.xz*.23+n3.xz*.12+vec2(-w.y,-w.z))*summerWaves;
    normal=normalize(normal+(viewMatrix*vec4(slope.x,0.,slope.y,0.)).xyz*summerEdge);
   }`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
   if(${guard}){
    float d=texture2D(summerDepth,(summerWorld+125.)/250.).r;
    vec3 bed=vec3(.18,.25,.12),deep=vec3(.012,.135,.13);
    vec3 transmission=exp(-vec3(2.6,.65,.48)*(.3+d*2.5));
    diffuseColor.rgb=mix(deep,bed,transmission)*1.25;
    float t=summerTime*summerSpeed,n=hfNoise(summerWorld*2.7+vec2(t*.08,-t*.06));
    float turbulent=hfTurbulence(summerWorld);
    float shore=(1.-smoothstep(.04,.4,summerEdge))*(.25+.75*n);
    float foam=smoothstep(.32,.75,turbulent*(.5+n))*summerFoam;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.89,.84),clamp((shore*.3+foam*.8)*summerFoam,0.,.88));
    roughnessFactor=mix(.105,.38,foam);metalnessFactor=0.;
   }`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   if(${guard}&&hfReflectionActive>.5){
    vec2 uv=hfReflectCoord.xy/hfReflectCoord.w;vec3 wn=(vec4(normal,0.)*viewMatrix).xyz;
    uv+=wn.xz*.008;float valid=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.)*step(0.,hfReflectCoord.w);
    vec3 reflected=texture2D(hfReflection,clamp(uv,.002,.998)).rgb;
    float cosTheta=clamp(dot(normal,normalize(vViewPosition)),0.,1.);
    float fresnel=.02037+.97963*pow(1.-cosTheta,5.);
    outgoingLight=mix(outgoingLight,reflected,clamp(fresnel*hfReflectionStrength*valid,0.,.92));
   }
   #include <opaque_fragment>`);
  material.hfShader=shader;
 };
 material.customProgramCacheKey=()=>simulated?'HF-GRAPHICS-V2-fluid':'HF-GRAPHICS-V2-water';
}
