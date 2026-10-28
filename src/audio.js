import {V8Core} from './v8-core.js';
import {factoryPresets} from './v8-settings.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const parameterTargets=new WeakMap();
const target=(param,value,time)=>{const previous=parameterTargets.get(param);if(previous!==undefined&&Math.abs(previous-value)<.0001)return;parameterTargets.set(param,value);param.setTargetAtTime(value,time,.055);};
export class Engine {
 constructor(settings=factoryPresets['Marine Jet Sprint V8']){this.settings={...settings};this.muted=false;this.volume=1;this.status='Tap Start engine or race to unlock audio.';this.reset();}
 reset(){this.rpm=this.settings.idleRPM;this.throttle=0;this.burble=0;}
 start(){
  if(this.ctx){this.ctx.resume().catch(()=>{});if(!this.source&&!this.initializing)this.ready=this.createSource(this.ctx);return this.ready;}
  const C=window.AudioContext||window.webkitAudioContext;if(!C){this.status='Web Audio is unavailable in this browser.';return;}
  const c=this.ctx=new C({latencyHint:'interactive'});c.resume().catch(()=>{});
  this.master=c.createGain();this.master.gain.value=.8;
  const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.15;
  const limiter=c.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.065;
  const ceiling=c.createWaveShaper(),curve=new Float32Array(4096);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.92*Math.tanh(x/.92);}ceiling.curve=curve;
  this.output=c.createGain();this.output.gain.value=this.muted?0:this.volume;
  this.master.connect(compressor);compressor.connect(limiter);limiter.connect(ceiling);ceiling.connect(this.output);this.output.connect(c.destination);
  this.synthBus=c.createGain();this.synthLevel=c.createGain();this.synthLevel.gain.value=1;this.synthLevel.connect(this.synthBus);
  // Future licensed sample sources connect here. Both paths share tone and safety.
  this.sampleInput=c.createGain();this.sampleInput.gain.value=0;this.sampleInput.connect(this.synthBus);
  this.highpass=c.createBiquadFilter();this.highpass.type='highpass';this.highpass.frequency.value=26;this.highpass.Q.value=.5;
  this.bass=c.createBiquadFilter();this.bass.type='lowshelf';this.bass.frequency.value=145;
  this.mid=c.createBiquadFilter();this.mid.type='peaking';this.mid.frequency.value=480;this.mid.Q.value=.65;
  this.treble=c.createBiquadFilter();this.treble.type='highshelf';this.treble.frequency.value=1800;
  this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.Q.value=.65;
  // A fixed saturator with smoothly crossfaded dry/wet avoids curve replacement clicks.
  this.drive=c.createGain();this.shaper=c.createWaveShaper();const saturation=new Float32Array(2048);
  for(let i=0;i<saturation.length;i++){const x=i/(saturation.length-1)*2-1;saturation[i]=Math.tanh(x*2.2)/2.2;}this.shaper.curve=saturation;
  this.dry=c.createGain();this.wet=c.createGain();this.engineGain=c.createGain();this.engineGain.gain.value=0;
  this.synthBus.connect(this.highpass);this.highpass.connect(this.bass);this.bass.connect(this.mid);this.mid.connect(this.treble);this.treble.connect(this.filter);
  this.filter.connect(this.dry);this.dry.connect(this.engineGain);this.filter.connect(this.drive);this.drive.connect(this.shaper);this.shaper.connect(this.wet);this.wet.connect(this.engineGain);this.engineGain.connect(this.master);
  this.echo=c.createDelay(.3);this.echo.delayTime.value=.079;this.echoFilter=c.createBiquadFilter();this.echoFilter.type='lowpass';this.echoFilter.frequency.value=1400;this.reflection=c.createGain();this.reflection.gain.value=0;
  this.engineGain.connect(this.echo);this.echo.connect(this.echoFilter);this.echoFilter.connect(this.reflection);this.reflection.connect(this.master);
  this.applyTone();
  this.ready=this.createSource(c);return this.ready;
 }
 async createSource(c){
  this.initializing=true;
  try{
   if(!c.audioWorklet||typeof AudioWorkletNode==='undefined')throw Error('AudioWorklet unavailable');
   const {default:url}=await import('./v8-worklet.js?worker&url');
   await c.audioWorklet.addModule(url);
   this.source=new AudioWorkletNode(c,'jet-sprint-v8',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{settings:this.settings}});
   this.source.connect(this.synthLevel);this.status='AudioWorklet · V8 combustion synthesis';
  }catch(error){
   try{
    this.core=new V8Core(c.sampleRate,this.settings);this.source=c.createScriptProcessor(1024,0,2);
    this.source.onaudioprocess=e=>this.core.render(e.outputBuffer.getChannelData(0),e.outputBuffer.getChannelData(1));
    this.source.connect(this.synthLevel);this.status='Compatibility audio · V8 combustion synthesis';
   }catch{this.status='Audio could not start. Tap Start engine to retry.';}
  }finally{this.initializing=false;}
 }
 configure(values){this.settings={...values};this.source?.port?.postMessage({settings:this.settings});this.core?.configure(this.settings);this.applyTone();}
 applyTone(){
  if(!this.engineGain)return;const v=this.settings,t=this.ctx.currentTime;
  target(this.bass.gain,(v.exhaustBass-50)*.14+v.lowEmphasis*.045,t);target(this.mid.gain,(v.exhaustMid-50)*.12,t);target(this.treble.gain,(v.exhaustTreble-50)*.14,t);
  target(this.filter.frequency,clamp((1000+this.rpm*.48+this.throttle*2300)*(1-v.muffler*.006),450,11000),t);
  target(this.drive.gain,1+v.distortion*.025,t);target(this.dry.gain,1-v.distortion*.006,t);target(this.wet.gain,v.distortion*.006,t);
  const distanceLoss=1/(1+v.distance/100*Math.max(0,(this.listenerDistance??60)-8)/45);
  target(this.engineGain.gain,v.volume/100*.46*(1-v.muffler*.0035)*distanceLoss,t);target(this.reflection.gain,v.reflections*.002,t);
 }
 setDistance(metres){this.listenerDistance=clamp(Number(metres)||1,1,500);}
 setSampleBlend(amount){if(!this.ctx)return;amount=clamp(amount,0,1);target(this.sampleInput.gain,amount,this.ctx.currentTime);target(this.synthLevel.gain,1-amount,this.ctx.currentTime);}
 setPreferences(muted,volume){this.muted=muted;this.volume=volume/100;if(this.output)target(this.output.gain,muted?0:this.volume,this.ctx.currentTime);}
 pause(){if(this.ctx)this.ctx.suspend().catch(()=>{});}
 update(speed,pressed,dt=1/60,maxSpeed=85/3.6,revOnly=false){
  const v=this.settings;dt=clamp(dt,0,.1);const ratio=clamp(speed/maxSpeed,0,1),throttle=clamp(Number(pressed),0,1);
  this.throttle+=(throttle-this.throttle)*(1-Math.exp(-v.throttleResponse*dt));
  const pumpLoad=revOnly?this.throttle*.4:this.throttle*(.65+.35*ratio),load=pumpLoad*(.5+v.loadEffect/100*.5);
  this.load=load;
  const demand=revOnly?this.throttle:clamp(this.throttle*.77+ratio*.23,0,1);
  const goal=v.idleRPM+(v.maxRPM-v.idleRPM)*demand*(1-(revOnly?0:(1-ratio)*this.throttle*v.loadEffect*.0008));
  const delta=(goal-this.rpm)*(1-Math.exp(-dt*4));this.rpm=clamp(this.rpm+clamp(delta,-v.rpmFall*dt,v.rpmRise*dt),v.idleRPM,v.maxRPM);
  this.source?.port?.postMessage({rpm:this.rpm,load});this.core?.setState(this.rpm,load);this.applyTone();
 }
 // Countdown and Bigfoot cues retain their existing entry points and master mute.
 vocal(angry){if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(angry?95:150,t);o.frequency.exponentialRampToValueAtTime(55,t+.4);f.type='lowpass';f.frequency.value=420;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.2,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.45);o.connect(f);f.connect(g);g.connect(this.master);o.start();o.stop(t+.5);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect();};}
 signal(kind){if(!this.ctx||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime,duration=kind==='go'?.65:.16;for(const frequency of kind==='go'?[880,1320]:[kind==='upper'?660:990]){const o=c.createOscillator(),gain=c.createGain();o.type='triangle';o.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(kind==='go'?.12:.18,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(gain);gain.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();gain.disconnect();};}}
}
