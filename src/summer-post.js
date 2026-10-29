import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
// Optional compact highlight/grade pass. Mobile with neutral grade bypasses it.
export class SummerPost {
 constructor(renderer,scene){this.renderer=renderer;this.scene=scene;this.composer=null;this.enabled=false;}
 configure(bloom,saturation,quality='low'){
  this.aoEnabled=quality==='high';this.enabled=quality!=='off'&&(bloom>0||Math.abs(saturation-1)>.001||this.aoEnabled);
  if(!this.enabled&&this.composer){for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();this.composer=null;this.grade=null;}
  if(this.enabled&&!this.composer){
   const type=this.renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
   const target=new THREE.WebGLRenderTarget(1,1,{type,depthTexture:new THREE.DepthTexture(1,1)});this.composer=new EffectComposer(this.renderer,target);this.renderPass=new RenderPass(this.scene,null);
   this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},tDepth:{value:null},inverseProjection:{value:new THREE.Matrix4()},ao:{value:0},stepSize:{value:new THREE.Vector2()},bloom:{value:bloom},saturation:{value:saturation}},vertexShader:'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse,tDepth;uniform mat4 inverseProjection;uniform vec2 stepSize;uniform float bloom,saturation,ao;varying vec2 uvOut;
    vec3 viewPosition(vec2 uv){float d=texture2D(tDepth,uv).r;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
    void main(){vec3 c=texture2D(tDiffuse,uvOut).rgb;vec3 glow=vec3(0.);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec3 s=texture2D(tDiffuse,uvOut+vec2(float(x),float(y))*stepSize*2.).rgb;glow+=max(s-vec3(1.2),vec3(0.))/9.;}c+=glow*bloom;
     if(ao>.5&&texture2D(tDepth,uvOut).r<.99999){vec3 p=viewPosition(uvOut),n=normalize(cross(dFdx(p),dFdy(p)));float occ=0.;float radius=clamp(650./max(1.,-p.z),2.,18.);for(int i=0;i<12;i++){float a=float(i)*2.39996;vec2 offset=vec2(cos(a),sin(a))*radius*(.4+float(i%3)*.3)*stepSize;vec3 delta=viewPosition(uvOut+offset)-p;float len=length(delta);occ+=max(0.,dot(n,delta/max(len,.001))-.18)*(1.-smoothstep(.1,2.2,len));}c*=1.-clamp(occ/12.*1.3,0.,.25);}
     float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(mix(vec3(l),c,saturation),1.);}`});
   this.composer.addPass(this.renderPass);this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());this.resize();
  }
  if(this.grade){this.grade.uniforms.bloom.value=bloom;this.grade.uniforms.saturation.value=saturation;this.grade.uniforms.ao.value=this.aoEnabled?1:0;}
 }
 resize(){if(!this.composer)return;const s=this.renderer.getSize(new THREE.Vector2()),d=this.renderer.getPixelRatio();this.composer.setPixelRatio(d);this.composer.setSize(s.x,s.y);this.grade.uniforms.stepSize.value.set(1/(s.x*d),1/(s.y*d));}
 render(camera){if(!this.enabled)return this.renderer.render(this.scene,camera);this.renderPass.camera=camera;this.grade.uniforms.tDepth.value=this.composer.readBuffer.depthTexture;this.grade.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);this.composer.render();}
}
