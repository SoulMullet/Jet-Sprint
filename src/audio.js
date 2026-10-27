// One two-revolution cycle contains eight exhaust events. Unequal bank amplitudes
// add the low V8 cadence without pushing the main pitch into electronic buzz.
export function exhaustWave(context,bank=0){
 const real=new Float32Array(49),imag=new Float32Array(49);
 const weights=bank?[.74,1,.65,.9,1,.72,.94,.68]:[1,.7,.93,.66,.76,1,.69,.96];
 for(let h=1;h<real.length;h++){
  const rolloff=Math.exp(-h/11)/8;
  for(let pulse=0;pulse<8;pulse++){
   const phase=2*Math.PI*h*(pulse/8+(bank?.009:0));
   real[h]+=Math.cos(phase)*weights[pulse]*rolloff;
   imag[h]-=Math.sin(phase)*weights[pulse]*rolloff;
  }
 }
 return context.createPeriodicWave(real,imag);
}
export class Engine {
 constructor(){this.reset();}
 reset(){this.rpm=900;this.throttle=0;this.burble=0;}
 start(){
  if(this.ctx){this.ctx.resume().catch(()=>{});return;}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const c=this.ctx=new C();
  this.master=c.createGain();this.master.gain.value=0;
  const limiter=c.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.004;limiter.release.value=.15;
  this.master.connect(limiter);const ceiling=c.createWaveShaper();const curve=new Float32Array(1024);for(let i=0;i<curve.length;i++)curve[i]=.88*Math.tanh((i/(curve.length-1)*2-1)/.88);ceiling.curve=curve;limiter.connect(ceiling);ceiling.connect(c.destination);
  this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=700;this.filter.Q.value=.65;
  const highpass=c.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=28;
  // Gentle bounded saturation rounds pulses; compressor provides output headroom.
  const shaper=c.createWaveShaper(),shape=new Float32Array(512);
  for(let i=0;i<shape.length;i++){const x=i/(shape.length-1)*2-1;shape[i]=Math.tanh(x*1.4)/1.4;}
  shaper.curve=shape;this.filter.connect(shaper);shaper.connect(highpass);highpass.connect(this.master);
  this.exhaust=[0,1].map(bank=>{
   const o=c.createOscillator(),g=c.createGain();o.setPeriodicWave(exhaustWave(c,bank));o.frequency.value=900/120;g.gain.value=.58;
   o.connect(g);g.connect(this.filter);o.start();return o;
  });
  const bass=c.createOscillator(),bassGain=c.createGain();bass.type='sine';bass.frequency.value=30;bassGain.gain.value=.24;bass.connect(bassGain);bassGain.connect(this.master);bass.start();this.bass=bass;
  const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
  const layer=(type,freq)=>{const filter=c.createBiquadFilter(),gain=c.createGain();filter.type=type;filter.frequency.value=freq;filter.Q.value=.5;gain.gain.value=0;noise.connect(filter);filter.connect(gain);gain.connect(this.master);return {filter,gain};};
  this.intake=layer('bandpass',420);this.jet=layer('lowpass',1800);noise.start();
  c.resume().catch(()=>{});
 }
 pause(){if(this.ctx)this.ctx.suspend().catch(()=>{});}
 update(speed,pressed,dt=1/60,maxSpeed=85/3.6){
  if(!this.ctx||this.ctx.state!=='running')return;
  const c=this.ctx,t=c.currentTime,ratio=Math.min(1,speed/maxSpeed);
  const blend=(value,target,rate)=>value+(target-value)*(1-Math.exp(-rate*dt));
  if(!pressed&&this.throttle>.45)this.burble=Math.max(this.burble,this.throttle);
  this.throttle=blend(this.throttle,pressed?1:0,pressed?9:6);
  this.burble*=Math.exp(-dt*3);
  // Jet pump load grows with speed: no unloaded instantaneous redline.
  const load=this.throttle*(.8+.2*ratio);
  const target=900+ratio*3900+this.throttle*(800+ratio*700);
  this.rpm=blend(this.rpm,target,target>this.rpm?3.8:2.2);
  const burble=this.burble*(.65+.35*Math.sin(t*37)*Math.sin(t*23));
  this.exhaust.forEach((o,i)=>o.frequency.setTargetAtTime(this.rpm/120*(1+i*.0015),t,.04));
  this.bass.frequency.setTargetAtTime(this.rpm/60,t,.06);
  this.filter.frequency.setTargetAtTime(380+this.rpm*.07+load*420+burble*180,t,.08);
  this.master.gain.setTargetAtTime(.58+load*.22+burble*.04,t,.07);
  this.intake.filter.frequency.setTargetAtTime(260+this.rpm*.1,t,.1);
  this.intake.gain.gain.setTargetAtTime(.035+load*.16,t,.1);
  this.jet.gain.gain.setTargetAtTime(ratio*.16+load*.025,t,.12);
 }
}
