import {defaultAudio,validateAudio} from './audio-settings.js';
import {V8Synth} from './v8-dsp.js';
const blend=(v,target,rate,dt)=>v+(target-v)*(1-Math.exp(-rate*dt));
const set=(param,value,time,tau=.045)=>param.setTargetAtTime(value,time,tau);
export class Engine {
 constructor({settings=defaultAudio(),workletURL}={}){this.settings=validateAudio(settings);this.workletURL=workletURL;this.muted=false;this.volume=1;this.sampleBlend=0;this.reset();}
 reset(){this.rpm=this.settings.idleRPM;this.throttle=0;this.burble=0;}
 setSettings(settings){this.settings=validateAudio(settings);this.processor?.port?.postMessage({settings:this.settings});this.synth?.configure(this.settings);if(this.ctx)this.tuneGraph();}
 start(){
  if(this.ctx){this.ctx.resume().catch(()=>{});return this.ready;}
  const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return Promise.resolve(false);
  const c=this.ctx=new C();c.resume().catch(()=>{});this.buildGraph(c);
  this.ready=this.createSource(c);return this.ready;
 }
 async createSource(c){
  try{
   if(!c.audioWorklet||!globalThis.AudioWorkletNode)throw Error('AudioWorklet unavailable');
   await c.audioWorklet.addModule(this.workletURL||new URL('./v8-worklet.js',import.meta.url).href);
   this.processor=new AudioWorkletNode(c,'jetsprint-v8',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
   this.processor.port.postMessage({settings:this.settings,rpm:this.rpm});this.processor.connect(this.synthGain);this.backend='AudioWorklet';
  }catch{
   // Compatibility path for older iOS browsers; one persistent stereo callback.
   this.synth=new V8Synth(c.sampleRate,this.settings);this.processor=c.createScriptProcessor(1024,0,2);
   this.processor.onaudioprocess=e=>this.synth.render(e.outputBuffer.getChannelData(0),e.outputBuffer.getChannelData(1),this.renderRPM||this.rpm,this.load||0,this.burble);
   this.processor.connect(this.synthGain);this.backend='Safari fallback';
  }
  return true;
 }
 buildGraph(c){
  this.master=c.createGain();this.master.gain.value=.85;
  this.engineBus=c.createGain();this.engineBus.gain.value=0;
  this.synthGain=c.createGain();this.sampleGain=c.createGain();this.sampleGain.gain.value=0;
  const drive=this.drive=c.createGain(),shaper=c.createWaveShaper(),shape=new Float32Array(2048);
  for(let i=0;i<shape.length;i++){const x=i/(shape.length-1)*2-1;shape[i]=Math.tanh(x*1.5)/1.5;}
  shaper.curve=shape;this.synthGain.connect(drive);this.sampleGain.connect(drive);drive.connect(shaper);
  const filter=(type,freq)=>{const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;return f;};
  this.highpass=filter('highpass',25);this.highpass.Q.value=.5;
  this.bassEQ=filter('lowshelf',130);this.midEQ=filter('peaking',480);this.midEQ.Q.value=.6;
  this.trebleEQ=filter('highshelf',2200);this.resonator=filter('peaking',90);this.resonator.Q.value=1.2;
  this.filter=filter('lowpass',1800);this.filter.Q.value=.55;
  shaper.connect(this.highpass);this.highpass.connect(this.bassEQ);this.bassEQ.connect(this.midEQ);this.midEQ.connect(this.trebleEQ);this.trebleEQ.connect(this.resonator);this.resonator.connect(this.filter);this.filter.connect(this.engineBus);
  this.growlFilter=filter('bandpass',210);this.growlFilter.Q.value=.7;this.growlGain=c.createGain();this.filter.connect(this.growlFilter);this.growlFilter.connect(this.growlGain);this.growlGain.connect(this.engineBus);
  this.engineBus.connect(this.master);
  const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
  const noiseLayer=(type,freq)=>{const f=filter(type,freq),gain=c.createGain();gain.gain.value=0;noise.connect(f);f.connect(gain);gain.connect(this.engineBus);return {filter:f,gain};};
  this.mechanical=noiseLayer('bandpass',1100);this.intake=noiseLayer('bandpass',420);this.jet=noiseLayer('lowpass',1000);noise.start();
  this.vibration=c.createOscillator();this.vibration.type='sine';this.vibrationGain=c.createGain();this.vibrationGain.gain.value=0;this.vibration.connect(this.vibrationGain);this.vibrationGain.connect(this.engineBus);this.vibration.start();
  this.echo=c.createDelay(.3);this.echo.delayTime.value=.105;this.wet=c.createGain();this.wet.gain.value=.04;this.engineBus.connect(this.echo);this.echo.connect(this.wet);this.wet.connect(this.master);
  const compressor=this.compressor=c.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=8;compressor.ratio.value=10;compressor.attack.value=.003;compressor.release.value=.14;
  const ceiling=c.createWaveShaper(),curve=new Float32Array(4096);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.85*Math.tanh(x/.85);}
  ceiling.curve=curve;
  this.output=c.createGain();this.output.gain.value=this.muted?0:this.volume;
  this.master.connect(compressor);compressor.connect(ceiling);ceiling.connect(this.output);this.output.connect(c.destination);this.tuneGraph();
 }
 tuneGraph(){
  const s=this.settings,t=this.ctx.currentTime;
  set(this.drive.gain,1+s.distortion*.028,t);set(this.synthGain.gain,1-this.sampleBlend,t);set(this.sampleGain.gain,this.sampleBlend,t);
  set(this.bassEQ.gain,-6+s.exhaustBass*.1+s.lowEmphasis*.045,t);set(this.midEQ.gain,(s.exhaustMid-50)*.12,t);set(this.trebleEQ.gain,(s.exhaustTreble-50)*.14,t);
  set(this.resonator.frequency,55+s.resonance*.7,t);set(this.resonator.gain,s.resonance*.065,t);set(this.growlGain.gain,s.growl*.004,t);
  set(this.wet.gain,s.reflections*.002,t);
 }
 // Extension point for an owned/licensed normalized seamless recording. Blending
 // zero keeps pure synthesis; one replaces it. Caller owns sample licensing.
 setSampleLayer(buffer,{referenceRPM=900,blend:mix=.35,loopStart=0,loopEnd=buffer?.duration}={}){
  if(!this.ctx)throw Error('Start audio before attaching a sample.');
  if(!buffer||!Number.isFinite(referenceRPM)||referenceRPM<=0||!Number.isFinite(mix)||!Number.isFinite(loopStart)||!Number.isFinite(loopEnd)||loopStart<0||loopEnd<=loopStart||loopEnd>buffer.duration)throw Error('Invalid sample loop.');
  const c=this.ctx,source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;gain.gain.value=0;
  source.connect(gain);gain.connect(this.sampleGain);source.start();set(gain.gain,1,c.currentTime,.06);
  const old=this.sample;if(old){set(old.gain.gain,0,c.currentTime,.04);old.source.stop(c.currentTime+.3);old.source.onended=()=>{old.source.disconnect();old.gain.disconnect();};}
  this.sample={source,gain,referenceRPM};this.sampleBlend=Math.max(0,Math.min(1,mix));this.tuneGraph();
 }
 setSampleBlend(mix){this.sampleBlend=this.sample?Math.max(0,Math.min(1,Number(mix)||0)):0;if(this.ctx)this.tuneGraph();}
 setPreferences(muted,volume){this.muted=muted;this.volume=Math.max(0,Math.min(1,volume/100));if(this.output)set(this.output.gain,muted?0:this.volume,this.ctx.currentTime,.025);}
 pause(){if(this.ctx)this.ctx.suspend().catch(()=>{});}
 update(speed,pressed,dt=1/60,maxSpeed=85/3.6,revOnly=false){
  const s=this.settings;dt=Math.max(0,Math.min(.1,dt));
  const throttle=typeof pressed==='number'?Math.max(0,Math.min(1,pressed)):Number(!!pressed),ratio=Math.max(0,Math.min(1,speed/maxSpeed));
  if(throttle<this.throttle-.25)this.burble=Math.max(this.burble,this.throttle);
  this.throttle=blend(this.throttle,throttle,2+s.throttleResponse*.16,dt);this.burble*=Math.exp(-dt*3);
  this.load=this.throttle*(.5+s.loadEffect*.005)*(.8+ratio*.2);
  const span=s.maxRPM-s.idleRPM;
  const target=s.idleRPM+span*(revOnly?this.throttle:Math.min(1,ratio*.72+this.throttle*(.14+ratio*.14)));
  this.rpm=blend(this.rpm,target,target>this.rpm?.7+s.rpmRise*.075:.5+s.rpmFall*.055,dt);
  if(!this.ctx||this.ctx.state!=='running')return;
  const t=this.ctx.currentTime,idle=Math.max(0,1-(this.rpm-s.idleRPM)/1500),wobble=idle*s.idleInstability*.65*(Math.sin(t*11)+.35*Math.sin(t*17.3));
  this.renderRPM=this.rpm+wobble;this.processor?.port?.postMessage({rpm:this.renderRPM,load:this.load,overrun:this.burble});
  set(this.filter.frequency,Math.max(250,(650+this.rpm*.22+this.load*1300)*(1-s.muffler*.007)),t,.08);
  set(this.engineBus.gain,(1.05+this.load*.4)*(s.engineVolume/100)/(1+s.distance*.025)/(1+s.distortion*.012),t,.055);
  set(this.intake.filter.frequency,230+this.rpm*.11,t);set(this.intake.gain.gain,this.load*.065,t);
  set(this.mechanical.gain.gain,s.mechanical*.0006*(.3+this.rpm/s.maxRPM),t);
  set(this.jet.gain.gain,s.waterInteraction*.0012*(ratio*.8+this.load*.2),t,.1);
  set(this.vibration.frequency,Math.max(18,this.rpm/60*2),t);set(this.vibrationGain.gain,s.vibration*.0006*(.5+this.load*.3),t);
  if(this.sample)set(this.sample.source.playbackRate,Math.max(.2,Math.min(8,this.rpm/this.sample.referenceRPM)),t,.1);
 }
 vocal(angry){if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='triangle';o.frequency.setValueAtTime(angry?95:150,t);o.frequency.exponentialRampToValueAtTime(55,t+.4);f.type='lowpass';f.frequency.value=420;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.2,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.45);o.connect(f);f.connect(g);g.connect(this.master);o.start();o.stop(t+.5);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect();};}
 signal(kind){if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,duration=kind==='go'?.65:.16;for(const frequency of kind==='go'?[880,1320]:[kind==='upper'?660:990]){const o=c.createOscillator(),gain=c.createGain();o.type='triangle';o.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(kind==='go'?.12:.18,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(gain);gain.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();gain.disconnect();};}}
}
