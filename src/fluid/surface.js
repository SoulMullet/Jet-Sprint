import * as THREE from 'three';
import {renderGeometry} from './render-geometry.js';
export class FluidSurface {
 constructor(solver,legacyMaterial,channel,nearest,width,cachedGeometry=null){
  this.solver=solver;
  this.uniforms={fluidState:{value:solver.texture},fluidBed:{value:solver.bedTexture},fluidSize:{value:solver.size},fluidCell:{value:solver.dx},fluidDebug:{value:0},waveScale:{value:2.4}};
  const m=this.material=legacyMaterial.clone();m.roughness=.23;m.metalness=.12;m.envMapIntensity=1;
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   const common='uniform float waveScale;uniform int fluidDebug;varying vec4 waterField;varying float shoreline;varying float displayHeight;\n';
   const sample=`uniform highp sampler2D fluidState;uniform highp sampler2D fluidBed;uniform float fluidSize;uniform float fluidCell;
    attribute float shoreFade;attribute vec2 shoreGradient;
    vec4 values;vec3 fluidNormal;
    vec4 sampleField(vec2 world,out vec2 slope){
     vec2 grid=(world+fluidSize*.5)/fluidCell-.5,base=floor(grid),t=fract(grid);
     vec4 sum=vec4(0.);float weight=0.;vec2 derivative=vec2(0.),weightDerivative=vec2(0.);
     for(int j=0;j<2;j++)for(int i=0;i<2;i++){
      vec2 q=vec2(float(i),float(j)),uv=(clamp(base+q,vec2(0.),vec2(fluidSize/fluidCell-1.))+.5)*fluidCell/fluidSize;
      vec4 s=texture2D(fluidState,uv);vec2 b=texture2D(fluidBed,uv).rg;float h=s.r+s.a,wet=b.g>.5&&h>.00001?1.:0.;
      vec2 blend=mix(vec2(1.)-t,t,q);float w=blend.x*blend.y*wet;
      vec2 dw=vec2((i==0?-1.:1.)*blend.y,(j==0?-1.:1.)*blend.x)*wet;
      float eta=b.r+h;sum+=vec4(eta,h,s.gb/max(h,.00001))*w;weight+=w;derivative+=eta*dw;weightDerivative+=dw;
     }
     slope=weight>.00001?(derivative*weight-sum.r*weightDerivative)/(weight*weight*fluidCell):vec2(0.);
     return weight>.00001?sum/weight:vec4(0.);
    }
    float visualHeight(float eta){float x=eta*waveScale;return .65*x/sqrt(.4225+x*x);}
   `;
   shader.vertexShader=common+sample+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    vec2 gradient;values=sampleField(position.xz,gradient);float x=values.r*waveScale;
    float derivative=.274625*waveScale/pow(.4225+x*x,1.5);
    vec2 visualSlope=gradient*derivative*shoreFade+visualHeight(values.r)*shoreGradient;
    objectNormal=normalize(vec3(-visualSlope.x,1.,-visualSlope.y));`);
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    waterField=values;shoreline=shoreFade;displayHeight=visualHeight(values.r)*shoreFade;transformed.y=displayHeight;`);
   shader.fragmentShader=common+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float crest=clamp(.5+displayHeight*1.6,0.,1.);
    diffuseColor.rgb=mix(vec3(.018,.085,.10),vec3(.045,.24,.25),crest);
    diffuseColor.rgb+=vec3(.18,.26,.25)*smoothstep(.025,.2,displayHeight)*.5;
    float foam=(1.-shoreline)*.42;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.68,.61),foam);
    if(fluidDebug==1)diffuseColor.rgb=mix(vec3(.02,.15,.7),vec3(.95,.2,.04),clamp(.5+waterField.r*3.,0.,1.));
    if(fluidDebug==2)diffuseColor.rgb=vec3(.5+waterField.b*.2,.2+length(waterField.ba)*.25,.5+waterField.a*.2);
    if(fluidDebug==3)diffuseColor.rgb=mix(vec3(1.,.6,.05),vec3(.03,.65,.35),smoothstep(.02,.3,waterField.g));`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float fresnel=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),4.);outgoingLight=mix(outgoingLight,vec3(.38,.56,.59),fresnel*.45);
    if(fluidDebug>0)outgoingLight=diffuseColor.rgb;
    #include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=> 'shallow-water-clipped-smooth-v061';
  this.ownsGeometry=!cachedGeometry;this.mesh=new THREE.Mesh(cachedGeometry||renderGeometry(channel,nearest,width),m);this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
 }
 sync(){const s=this.solver;this.uniforms.fluidState.value=s.texture;this.uniforms.fluidBed.value=s.bedTexture;this.uniforms.fluidSize.value=s.size;this.uniforms.fluidCell.value=s.dx;}
 dispose(){if(this.ownsGeometry)this.mesh.geometry.dispose();this.material.dispose();}
}
