// Shared by both the procedural mobile surface and the retained GPU solver.
export function waterUniforms(time){return {summerTime:time,summerWaves:{value:.8},summerSpeed:{value:1},summerFoam:{value:1}};}
const common=`
 uniform float summerTime,summerWaves,summerSpeed,summerFoam;
 varying vec2 summerWorld;varying float summerEdge;
 vec3 summerWave(vec2 p){float t=summerTime*summerSpeed;
 float a=dot(p,vec2(.48,.23))+t*1.15,b=dot(p,vec2(-.27,.63))-t*.9;
 float h=sin(a)*.055+sin(b)*.035;
 return vec3(h,cos(a)*.055*.48+cos(b)*.035*-.27,cos(a)*.055*.23+cos(b)*.035*.63)*summerWaves;
 }
`;
export function finishSummerWater(material,uniforms,{simulated=false}={}){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
  previous?.(shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=common+(simulated?'':'attribute float shoreFade;\n')+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n summerWorld=position.xz;summerEdge=shoreFade;`);
  // Add a small wind surface to either renderer, pinned to the exact shoreline.
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`transformed.y+=summerWave(position.xz).x*shoreFade;\n#include <project_vertex>`);
  shader.fragmentShader=common+'uniform sampler2D summerDepth;uniform vec3 summerBoat;uniform float summerStrength;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   ${simulated?'if(fluidDebug==0){':''}
   float summerD=texture2D(summerDepth,(summerWorld+125.)/250.).r;
   vec3 summerColor=mix(vec3(.065,.36,.25),vec3(.009,.18,.20),smoothstep(.05,.85,summerD));
   float summerT=summerTime*summerSpeed;
   float summerNoise=.65+.35*sin(summerWorld.x*5.7+sin(summerWorld.y*3.1)+summerT*1.6);
   float summerF=(1.-smoothstep(0.,.45,summerEdge))*summerNoise*.38*summerFoam;
   float underHull=exp(-length(summerWorld-summerBoat.xz)*1.5)*.16;
   diffuseColor.rgb=mix(summerColor*(1.-underHull),vec3(.81,.91,.79),summerF);
   ${simulated?'}':''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   vec2 p=summerWorld;float t=summerTime*summerSpeed;
   vec2 ripple=vec2(cos(dot(p,vec2(3.2,1.7))+t*2.4),sin(dot(p,vec2(-1.4,4.1))-t*1.8))*.055*summerWaves;
   vec3 wave=summerWave(p);normal=normalize(normal+(viewMatrix*vec4(-wave.y-ripple.x,0.,-wave.z-ripple.y,0.)).xyz*.8*summerEdge);`);
  material.summerShader=shader;
 };
 material.customProgramCacheKey=()=>simulated?'summer-1987-fluid-v1':'summer-1987-procedural-v1';
 material.summerUniforms=uniforms;
}
