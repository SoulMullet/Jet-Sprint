// Allocation-free DSP shared by AudioWorklet, Safari fallback and offline tests.
// A cross-plane 1-8-4-3-6-5-7-2 order: globally eight firings / 720 crank degrees,
// with uneven 90/180/270-degree intervals in each exhaust bank.
export const firingBanks=[0,1,1,0,1,0,0,1];
export class V8Synth {
 constructor(sampleRate,settings){
  this.sampleRate=sampleRate;this.seed=173;this.phase=0;this.untilFire=0;this.event=0;this.firings=0;this.rpm=900;this.load=0;this.overrun=0;
  this.settings={...settings};this.target={...settings};this.keys=Object.keys(settings);
  this.envelope=new Float64Array(8);this.osc=new Float64Array(8);this.amplitude=new Float64Array(8);
  this.lowNoise=0;this.dc=[0,0];this.previous=[0,0];
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 configure(settings){Object.assign(this.target,settings);}
 render(left,right,rpm=this.rpm,load=this.load,overrun=0){
  const n=left.length,s=this.settings,smooth=1-Math.exp(-n/(this.sampleRate*.035));
  for(const key of this.keys)s[key]+=(this.target[key]-s[key])*smooth;
  const inv=1/this.sampleRate,lope=s.camLope/100,irregular=s.pulseIrregularity/100,idle=Math.max(0,1-(rpm-s.idleRPM)/1600);
  const duration=s.pulseDuration*.001*(1-.65*Math.max(0,Math.min(1,(rpm-900)/7500)));
  const decay=Math.exp(-inv/duration),attack=.35+s.pulseSharpness/100*.65;
  const tone=48+s.resonance*.48+load*14,omega=2*Math.PI*tone*inv;
  const richness=s.harmonics/100,rasp=s.rasp/100,crackle=s.crackle/100;
  const strength=(.28+s.pulseStrength*.006)*(s.combustion/100),width=s.stereoWidth/100;
  for(let i=0;i<n;i++){
   this.rpm+=(rpm-this.rpm)*.0015;this.load+=(load-this.load)*.0015;
   this.phase+=this.rpm/120*inv;
   const cam=Math.sin(this.phase*2*Math.PI)+.4*Math.sin(this.phase*4*Math.PI+.8);
   this.untilFire-=inv;
   if(this.untilFire<=0){
    const voice=this.event%8,variation=this.random()*2-1;
    this.envelope[voice]=1;this.osc[voice]=0;
    // All cylinders fire; the cam modulates charge rather than dropping events.
    this.amplitude[voice]=(.88+variation*irregular*.16)*(1+idle*lope*(.32*cam+(voice%3===0?.16:-.06)));
    this.event++;this.firings++;
    this.untilFire+=15/Math.max(450,this.rpm)*(1+variation*irregular*.08+idle*lope*.09*cam);
   }
   const noise=this.random()*2-1;this.lowNoise+=(noise-this.lowNoise)*.018;
   let a=0,b=0;
   for(let v=0;v<8;v++){
    const env=this.envelope[v];if(env<.0005)continue;
    this.osc[v]+=omega;
    const p=this.osc[v],onset=Math.min(1,p*(1+attack*3));
    const pulse=env*onset*this.amplitude[v]*(Math.sin(p)+richness*.24*Math.sin(p*2.03)+richness*.1*Math.sin(p*3.9)+noise*rasp*.15*env);
    if(firingBanks[v])b+=pulse;else a+=pulse;
    this.envelope[v]*=decay;
   }
   const rumble=this.lowNoise*s.rumble*.012*(.6+idle*lope*cam*.3);
   const pop=overrun*crackle*(noise>.997?noise*1.6:0);
   a=a*strength*.32+rumble+pop;b=b*strength*.32+rumble+pop;
   const mid=(a+b)*.5,side=(a-b)*.5*width;
   // Remove DC before nonlinear processing. Fixed gain and a smooth bound leave
   // room for the Web Audio exhaust EQ and output compressor.
   for(let ch=0;ch<2;ch++){
    const x=ch?mid-side:mid+side,y=x-this.previous[ch]+.996*this.dc[ch];this.previous[ch]=x;this.dc[ch]=y;
    (ch?right:left)[i]=Math.tanh(y*.8)*.7;
   }
  }
 }
}
