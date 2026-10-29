// World-space weathering survives the existing per-material prop batching.
export function venueMaterials(materials){
 for(const name of ['wood','plank','roof','metal','rust']){
  const material=materials[name];material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 propPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npropPoint=position;');
   shader.fragmentShader='varying vec3 propPoint;\nfloat propHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat propNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(propHash(i),propHash(i+vec2(1.,0.)),f.x),mix(propHash(i+vec2(0.,1.)),propHash(i+vec2(1.)),f.x),f.y);}\n'+shader.fragmentShader;
   const wood=name==='wood'||name==='plank';
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 p=propPoint.xz;float n=propNoise(p*3.+propPoint.y),wear=propNoise(p*.27+propPoint.y*.1);
    ${wood?`float grain=sin(propPoint.y*130.+propNoise(p*.7)*18.)*.5+.5;float seam=1.-smoothstep(.0,.025,abs(fract(propPoint.y*2.8)-.5));diffuseColor.rgb*=.75+n*.2+grain*.12;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.31,.25),wear*.32);diffuseColor.rgb*=1.-seam*.18;`:
     name==='roof'?`float seams=step(.93,fract(propPoint.z*2.));float row=step(.94,fract(propPoint.x*1.3+floor(propPoint.z*2.)*.5));diffuseColor.rgb*=.75+n*.25;diffuseColor.rgb*=1.-(seams+row)*.15;`:
     `diffuseColor.rgb*=.8+n*.2;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.1,.04),smoothstep(.62,.8,wear)*.4);`}
   `);
  };material.customProgramCacheKey=()=> 'HF weathered '+name;
 }
 materials.glass.emissiveIntensity=.08;materials.glass.roughness=.12;materials.glass.metalness=.45;
 materials.teal.roughness=.27;materials.teal.metalness=.18;
}
