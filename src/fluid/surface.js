import * as THREE from 'three';
export class FluidSurface {
 constructor(solver,legacyMaterial){
  this.solver=solver;this.uniforms={fluidState:{value:solver.texture},fluidBed:{value:solver.bedTexture},fluidSize:{value:solver.size},fluidCell:{value:solver.dx},fluidDebug:{value:0}};
  const m=this.material=legacyMaterial.clone();m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   const uniforms='uniform highp sampler2D fluidState;uniform highp sampler2D fluidBed;uniform float fluidSize;uniform float fluidCell;uniform int fluidDebug;\n';
   // Coordinates are world-aligned; the mesh has identity transform.
   const sample=`vec2 fluidUV(vec2 p){return clamp((p+fluidSize*.5)/fluidSize,vec2(.00001),vec2(.99999));}
    float eta(vec2 p){vec2 uv=fluidUV(p);vec4 a=texture2D(fluidState,uv);return a.r+a.a+texture2D(fluidBed,uv).r;}
    vec3 waterNormal(vec2 p){float dx=eta(p+vec2(fluidCell,0.))-eta(p-vec2(fluidCell,0.));float dz=eta(p+vec2(0.,fluidCell))-eta(p-vec2(0.,fluidCell));return normalize(vec3(-dx,2.*fluidCell,-dz));}\n`;
   shader.vertexShader=uniforms+'varying vec2 fluidPosition;\n'+sample+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=waterNormal(position.xz);');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfluidPosition=position.xz;transformed.y=eta(position.xz);');
   shader.fragmentShader=uniforms+'varying vec2 fluidPosition;\n'+sample+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec4 state=texture2D(fluidState,fluidUV(fluidPosition));state.r+=state.a;vec2 terrain=texture2D(fluidBed,fluidUV(fluidPosition)).rg;
    if(fluidDebug!=3&&(terrain.y<.5||state.r<.00001))discard;
    float foam=1.-smoothstep(.05,.35,state.r);diffuseColor.rgb=mix(vec3(.02,.15,.17),vec3(.55,.67,.61),foam);
    if(fluidDebug==1)diffuseColor.rgb=mix(vec3(.02,.15,.7),vec3(.95,.2,.04),clamp(.5+eta(fluidPosition)*3.,0.,1.));
    if(fluidDebug==2){vec2 flow=state.gb/max(state.r,.00001);diffuseColor.rgb=vec3(.5+flow.x*.2,.2+length(flow)*.25,.5+flow.y*.2);}
    if(fluidDebug==3)diffuseColor.rgb=terrain.y<.5?vec3(.12):state.r<.08?vec3(1.,.6,.05):vec3(.03,.65,.35);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize((viewMatrix*vec4(waterNormal(fluidPosition),0.)).xyz);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','if(fluidDebug>0)outgoingLight=diffuseColor.rgb;\n#include <opaque_fragment>');
  };m.customProgramCacheKey=()=> 'shallow-water-phase1';
  this.mesh=new THREE.Mesh(this.geometry(),m);this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
 }
 geometry(){const s=this.solver,g=new THREE.PlaneGeometry(s.size-s.dx,s.size-s.dx,s.n-1,s.n-1);g.rotateX(-Math.PI/2);return g;}
 sync(){const s=this.solver;this.uniforms.fluidState.value=s.texture;this.uniforms.fluidBed.value=s.bedTexture;this.uniforms.fluidSize.value=s.size;this.uniforms.fluidCell.value=s.dx;if(this.resolution!==s.n){this.mesh.geometry.dispose();this.mesh.geometry=this.geometry();this.resolution=s.n;}}
 dispose(){this.mesh.geometry.dispose();this.material.dispose();}
}
