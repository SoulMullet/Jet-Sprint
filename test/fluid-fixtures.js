// Shared numerical fixtures for CPU tests and the explicit browser/GPU harness.
export function fluidFixture(n=16,kind='lake'){
 const size=24,dx=size/n,bed=new Float32Array(n*n),mask=new Uint8Array(n*n),initial=new Float32Array(n*n*4),terrain=new Float32Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;mask[i]=kind==='obstacle'&&x===Math.floor(n/2)&&y>2&&y<n-3?0:1;
  bed[i]=['dry','shock'].includes(kind)?0:-.7+.25*Math.sin(x*.6)*Math.cos(y*.7);
  const h=mask[i]?(kind==='shock'?(x<n/2?3.9:.01):kind==='dry'?(x<n/3?1:0):-bed[i]+(kind==='wave'||kind==='obstacle'?.12*Math.exp(-((x-n*.3)**2+(y-n*.5)**2)/3):0)):0;
  initial.set([h,kind==='shock'?h*5.5:0,0,0],i*4);terrain.set([bed[i],mask[i],0,1],i*4);
 }return {n,size,dx,bed,mask,initial,terrain};
}
export function unpack(data){const a=new Float64Array(data.length/4*3);for(let i=0;i<data.length/4;i++){a.set(data.slice(i*4,i*4+3),i*3);a[i*3]+=data[i*4+3];}return a;}
// Uniform cell area is omitted from this volume proxy; it cancels in relative errors.
export function stats(state){let volume=0,min=Infinity,max=-Infinity,speed=0;for(let i=0;i<state.length;i+=3){volume+=state[i];min=Math.min(min,state[i]);max=Math.max(max,state[i]);speed=Math.max(speed,Math.hypot(state[i+1],state[i+2])/Math.max(1e-5,state[i]));if(!Number.isFinite(volume+speed))throw Error('Nonfinite fluid state');}return {volume,min,max,speed};}
