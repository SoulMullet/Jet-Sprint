// Audio-thread DSP, also usable offline for deterministic regression checks.
// A cross-plane four-stroke V8 fires once per 90 crank degrees: RPM / 15 Hz.
// 1-8-4-3-6-5-7-2 => L R R L R L L R. No cylinders are dropped for the lope.
export const firingBanks=[0,1,1,0,1,0,0,1];
const tau=2*Math.PI;
export class V8Core {
 constructor(rate,settings,seed=721){
  this.keys=Object.keys(settings);this.rate=rate;this.values={...settings};this.target={...settings};this.seed=seed;this.rpm=settings.idleRPM;this.targetRPM=this.rpm;this.load=0;this.targetLoad=0;this.time=0;this.cycle=0;this.event=0;this.until=0;this.events=0;this.previousLoad=0;this.overrun=0;
  this.slow=new Float64Array(2);this.fast=new Float64Array(2);this.r1=new Float64Array(2);this.r2=new Float64Array(2);this.g1=new Float64Array(2);this.g2=new Float64Array(2);this.noiseLow=0;this.waterLow=0;this.previousInput=new Float64Array(2);this.previousHigh=new Float64Array(2);
 }
 random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296;}
 configure(settings){for(const id of this.keys)if(Number.isFinite(settings[id]))this.target[id]=settings[id];}
 setState(rpm,load){this.targetRPM=rpm;this.targetLoad=load;}
 render(left,right){
  const v=this.values,n=left.length,dt=n/this.rate,smooth=1-Math.exp(-dt/.055);
  for(const id of this.keys)v[id]+=(this.target[id]-v[id])*smooth;
  const k=1/this.rate,highDecay=Math.exp(-tau*18/this.rate),follow=1-Math.exp(-k/.035),idleFade=Math.max(0,Math.min(1,(1900-this.rpm)/1000));
  const duration=v.pulseDuration*.001*(.3+.7*idleFade),slowDecay=Math.exp(-k/duration),fastDecay=Math.exp(-k/(.0008+(1-v.pulseSharpness/100)*.004));
  const resonance=v.resonance/100,ringDecay=Math.exp(-k/(.018+resonance*.07));
  const ringFrequency=52+v.exhaustBass*.12+this.rpm*.002;
  const rc=2*ringDecay*Math.cos(tau*ringFrequency*k),rr=ringDecay*ringDecay,ri=Math.sin(tau*ringFrequency*k)*.8;
  const growlDecay=Math.exp(-k/.017),gc=2*growlDecay*Math.cos(tau*(145+this.rpm*.012)*k),gr=growlDecay*growlDecay;
  const lope=v.camLope/100,instability=v.idleInstability/100,irregular=v.pulseIrregularity/100;
  const strength=v.pulseStrength/100,combustion=v.combustion/100,width=v.stereoWidth/100,rich=v.harmonics/100;
  const rumble=v.rumble/100,rasp=v.rasp/100,water=v.water/100,mechanical=v.mechanical/100,vibration=v.vibration/100,growl=v.growl/100;
  const oldLoad=this.previousLoad;this.previousLoad=this.targetLoad;
  if(oldLoad-this.targetLoad>.006&&this.rpm>2200)this.overrun=Math.max(this.overrun,Math.min(1,(oldLoad-this.targetLoad)*12));
  for(let i=0;i<n;i++){
   this.rpm+=(this.targetRPM-this.rpm)*follow;this.load+=(this.targetLoad-this.load)*follow;
   this.time+=k;this.cycle+=this.rpm/120*k;if(this.cycle>1)this.cycle-=1;
   this.overrun*=.99992;
   let impulse0=0,impulse1=0;
   this.until-=k;
   if(this.until<=0){
    const bank=firingBanks[this.event],random=this.random()*2-1;
    // Slow cam surge plus bank grouping yields glug-glug, with bounded jitter.
    const cam=Math.sin(tau*this.cycle+1.1)+.38*Math.sin(tau*this.cycle*2-.6);
    const amp=(.72+.28*this.load)*(1+idleFade*lope*.36*cam)*(1+random*irregular*.13);
    const impulse=amp*strength*(.2+.8*combustion);
    this.slow[bank]+=impulse;this.fast[bank]+=impulse;
    if(bank===0)impulse0=impulse;else impulse1=impulse;
    const jitter=1+random*(.012+irregular*.025)+idleFade*lope*.035*cam;
    const idleWobble=1+idleFade*instability*(.025*Math.sin(tau*this.cycle)+.01*Math.sin(this.time*5.3));
    this.until+=15/(this.rpm*idleWobble)*jitter;
    this.event=(this.event+1)%8;this.events++;
   }
   const noise=this.random()*2-1;this.noiseLow+=.055*(noise-this.noiseLow);this.waterLow+=.012*(noise-this.waterLow);
   const intake=noise*(.008+.065*this.load)*(this.rpm/v.maxRPM)*rich;
   const rum=(Math.sin(tau*this.cycle*2)+.35*Math.sin(tau*this.cycle*3))*rumble*.075*(.7+.3*this.load);
   const mech=(noise-this.noiseLow)*mechanical*.035+Math.sin(tau*this.cycle*16)*vibration*.008;
   const wet=this.waterLow*water*.11*(.3+this.load);
   const crack=this.overrun*v.crackle/100*Math.max(0,noise-.994)*26;
   for(let b=0;b<2;b++){
    const impulse=b===0?impulse0:impulse1;
    this.slow[b]*=slowDecay;this.fast[b]*=fastDecay;
    const ring=rc*this.r1[b]-rr*this.r2[b]+impulse*ri;this.r2[b]=this.r1[b];this.r1[b]=ring;
    const snarl=gc*this.g1[b]-gr*this.g2[b]+impulse*.035;this.g2[b]=this.g1[b];this.g1[b]=snarl;
    const envelope=this.slow[b]-this.fast[b];
    const pulse=envelope*.32+ring*(.3+resonance*.4)+snarl*growl*.16;
    // Noise is gated by combustion rather than being a constant buzzy oscillator.
    const grit=(noise-this.noiseLow)*envelope*rasp*.065*(.25+this.load)+rich*.07*Math.sin(pulse*2.4);
    const out=(pulse+grit+rum+intake+mech+wet+crack)*.48;
    const high=out-this.previousInput[b]+highDecay*this.previousHigh[b];this.previousInput[b]=out;this.previousHigh[b]=high;
    const safe=.95*Math.tanh(high/.95);if(b===0)left[i]=safe;else right[i]=safe;
   }
   const mid=(left[i]+right[i])*.5,side=(left[i]-right[i])*.5*width;
   left[i]=mid+side;right[i]=mid-side;
  }
 }
}
