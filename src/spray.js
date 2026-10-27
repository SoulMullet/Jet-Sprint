// Bounded ballistic envelope. Matches emitter velocity/lifetime; includes boat
// translation and lateral drift, so a distant figure cannot be hit by a cone ray.
export function sprayReaches(target,b,speed,distance,volume){
 if(distance<=0||volume<=0)return false;
 const fx=Math.cos(b.angle),fz=Math.sin(b.angle),slide=-b.vx*fz+b.vz*fx;
 const jet=(6+speed*.65+(b.throttle?4:0))*distance;
 const vx=b.vx*.25-fx*jet-slide*fz*.5,vz=b.vz*.25-fz*jet+slide*fx*.5;
 const x=target.x-(b.x-fx*2),z=target.z-(b.z-fz*2),v2=vx*vx+vz*vz;
 if(v2<.01)return false;
 const t=(x*vx+z*vz)/v2;
 if(t<0||t>2.6)return false;
 if(Number.isFinite(b.sprayAge)&&Math.abs(t-b.sprayAge)>.06)return false;
 const y=.4+(3.5+speed*.08)*t-4.9*t*t;
 return y>=0&&y<=6.5&&Math.hypot(x-vx*t,z-vz*t)<1.3+t*(1+Math.abs(slide)*.15);
}
