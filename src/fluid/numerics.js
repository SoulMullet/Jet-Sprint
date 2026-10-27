// First-order hydrostatic reconstruction + HLL (Audusse-style bed balance).
// State: depth h, momenta hu/hv; bed is stored separately, elevation = bed + h.
export const fluidConfig = Object.freeze({gravity:9.81,dry:1e-5,friction:.08,maxSpeed:6,designDepth:4,step:1/120,maxSubsteps:4});
export function stableStep(dx,c=fluidConfig){return Math.min(c.step,.24*dx/(c.maxSpeed+Math.sqrt(c.gravity*c.designDepth)));}
export function hll(a,b,za,zb,nx,ny,c=fluidConfig){
 const bed=Math.max(za,zb),ha=Math.max(0,a[0]+za-bed),hb=Math.max(0,b[0]+zb-bed);
 const ua=a[0]>c.dry?(a[1]*nx+a[2]*ny)/a[0]:0,va=a[0]>c.dry?(-a[1]*ny+a[2]*nx)/a[0]:0;
 const ub=b[0]>c.dry?(b[1]*nx+b[2]*ny)/b[0]:0,vb=b[0]>c.dry?(-b[1]*ny+b[2]*nx)/b[0]:0;
 const sl=Math.min(0,ua-Math.sqrt(c.gravity*ha),ub-Math.sqrt(c.gravity*hb)),sr=Math.max(0,ua+Math.sqrt(c.gravity*ha),ub+Math.sqrt(c.gravity*hb));
 const U=[ha,ha*ua,ha*va],V=[hb,hb*ub,hb*vb],F=[U[1],U[1]*ua+.5*c.gravity*ha*ha,U[1]*va],G=[V[1],V[1]*ub+.5*c.gravity*hb*hb,V[1]*vb];
 return {flux:F.map((f,i)=>sr-sl>1e-8?(sr*f-sl*G[i]+sl*sr*(V[i]-U[i]))/(sr-sl):0),correction:.5*c.gravity*(a[0]*a[0]-ha*ha)};
}
// CPU oracle for validation only. Gameplay uses the GPU kernels, never this loop.
export function referenceStep(state,bed,mask,n,dx,dt,c=fluidConfig){
 const faces=Array.from({length:n*n},()=>[]),alpha=new Float64Array(n*n).fill(1),beta=new Float64Array(n*n).fill(1),out=new Float64Array(state.length);
 const normals=[[1,0],[-1,0],[0,1],[0,-1]];
 for(let i=0;i<n*n;i++){
  if(!mask[i])continue;const x=i%n,y=Math.floor(i/n),a=Array.from(state.slice(i*3,i*3+3));let drain=0,fill=0;
  for(const [nx,ny] of normals){const xx=x+nx,yy=y+ny,j=xx<0||xx>=n||yy<0||yy>=n?-1:yy*n+xx,wall=j<0||!mask[j];
   const b=wall?[a[0],a[1]-2*(a[1]*nx+a[2]*ny)*nx,a[2]-2*(a[1]*nx+a[2]*ny)*ny]:Array.from(state.slice(j*3,j*3+3));
   const f=hll(a,b,bed[i],wall?bed[i]:bed[j],nx,ny,c);faces[i].push({...f,j:wall?i:j,nx,ny});drain+=Math.max(0,f.flux[0]);fill+=Math.max(0,-f.flux[0]);
  }alpha[i]=Math.min(1,state[i*3]*dx/(dt*drain+1e-30));beta[i]=Math.min(1,Math.max(0,c.designDepth-state[i*3])*dx/(dt*fill+1e-30));
 }
 for(let i=0;i<n*n;i++){
  if(!mask[i])continue;let h=state[i*3],qx=state[i*3+1],qy=state[i*3+2];
  for(const {flux:f,correction,j,nx,ny} of faces[i]){const factor=f[0]>=0?Math.min(alpha[i],beta[j]):Math.min(alpha[j],beta[i]),mass=f[0]*factor,mom=f[1]*factor+correction,tan=f[2]*factor;h-=dt/dx*mass;qx-=dt/dx*(mom*nx-tan*ny);qy-=dt/dx*(mom*ny+tan*nx);}
  h=Math.max(0,h);qx/=1+c.friction*dt;qy/=1+c.friction*dt;const speed=Math.hypot(qx,qy)/Math.max(c.dry,h),scale=Math.min(1,c.maxSpeed/Math.max(speed,1e-20));
  out.set([h,h>c.dry?qx*scale:0,h>c.dry?qy*scale:0],i*3);
 }return out;
}
export function makeDomain(n,size,nearest,width){
 const dx=size/n,bed=new Float32Array(n*n),mask=new Uint8Array(n*n),initial=new Float32Array(n*n*4),terrain=new Float32Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,wx=-size/2+(x+.5)*dx,wz=-size/2+(y+.5)*dx,p=nearest(wx,wz),d=Math.hypot(wx-p.x,wz-p.z);
  mask[i]=d<=width?1:0;bed[i]=mask[i]?-(.18+.95*Math.max(0,1-(d/width)**2)):.2;
  terrain.set([bed[i],mask[i],0,1],i*4);initial.set([mask[i]?Math.max(0,-bed[i]):0,0,0,0],i*4);
 }return {n,size,dx,bed,mask,initial,terrain};
}
