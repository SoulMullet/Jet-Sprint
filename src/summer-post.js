import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
// Optional compact highlight/grade pass. Mobile with neutral grade bypasses it.
export class SummerPost {
 constructor(renderer,scene){this.renderer=renderer;this.scene=scene;this.composer=null;this.enabled=false;}
 configure(bloom,saturation){
  this.enabled=bloom>0||Math.abs(saturation-1)>.001;
  if(!this.enabled&&this.composer){for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();this.composer=null;this.grade=null;}
  if(this.enabled&&!this.composer){
   const type=this.renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
   const target=new THREE.WebGLRenderTarget(1,1,{type});this.composer=new EffectComposer(this.renderer,target);this.renderPass=new RenderPass(this.scene,null);
   this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},stepSize:{value:new THREE.Vector2()},bloom:{value:bloom},saturation:{value:saturation}},vertexShader:'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 stepSize;uniform float bloom,saturation;varying vec2 uvOut;
    void main(){vec3 c=texture2D(tDiffuse,uvOut).rgb;vec3 glow=vec3(0.);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec3 s=texture2D(tDiffuse,uvOut+vec2(float(x),float(y))*stepSize*2.).rgb;glow+=max(s-vec3(.85),vec3(0.))/9.;}c+=glow*bloom;float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(mix(vec3(l),c,saturation),1.);}`});
   this.composer.addPass(this.renderPass);this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());this.resize();
  }
  if(this.grade){this.grade.uniforms.bloom.value=bloom;this.grade.uniforms.saturation.value=saturation;}
 }
 resize(){if(!this.composer)return;const s=this.renderer.getSize(new THREE.Vector2()),d=this.renderer.getPixelRatio();this.composer.setPixelRatio(d);this.composer.setSize(s.x,s.y);this.grade.uniforms.stepSize.value.set(1/(s.x*d),1/(s.y*d));}
 render(camera){if(!this.enabled)return this.renderer.render(this.scene,camera);this.renderPass.camera=camera;this.composer.render();}
}
