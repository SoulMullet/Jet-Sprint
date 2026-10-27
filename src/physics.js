export const settings = { top:85, drift:65, steer:85, acceleration:21, cameraResponse:8, effects:1 };
export const channel = { water:7.3, bank:8.4, hullLimit:6.5 };
export const course = [[0, -35],[25,-34],[37,-19],[25,-3],[35,15],[23,33],[0,36],[-27,30],[-36,12],[-22,-2],[-34,-20],[-23,-34]].map(([x,z])=>[x*1.42,z*1.42]);
export function stepBoat(b, input, dt, nearest) {
 const forward={x:Math.cos(b.angle),z:Math.sin(b.angle)};
 const speed=Math.hypot(b.vx,b.vz), max=settings.top/3.6;
 const steer=(Number(!!input.right)-Number(!!input.left));
 // Fast turn-in, slightly faster recovery; retain inertia instead of snapping heading.
 const targetYaw=steer*(settings.steer/75)*1.65*(.18+Math.min(speed/10,1)*.82);
 b.yawRate=(b.yawRate||0)+(targetYaw-(b.yawRate||0))*(1-Math.exp(-dt*(steer?18:24)));
 b.angle+=b.yawRate*dt;
 if(input.throttle){b.vx+=forward.x*settings.acceleration*dt;b.vz+=forward.z*settings.acceleration*dt;}
 const lateral=-b.vx*forward.z+b.vz*forward.x;
 const grip=7-(settings.drift/100)*5.8;
 b.vx+=forward.z*lateral*Math.min(1,grip*dt);b.vz-=forward.x*lateral*Math.min(1,grip*dt);
 const drag=.12+speed*speed*(settings.acceleration-.12*max)/(max*max*max);
 b.vx*=Math.exp(-drag*dt);b.vz*=Math.exp(-drag*dt);
 b.x+=b.vx*dt;b.z+=b.vz*dt;
 const p=nearest(b.x,b.z), dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);
 if(d>channel.hullLimit){const nx=dx/d,nz=dz/d;b.x=p.x+nx*channel.hullLimit;b.z=p.z+nz*channel.hullLimit;const outward=b.vx*nx+b.vz*nz;if(outward>0){b.vx-=outward*1.35*nx;b.vz-=outward*1.35*nz;}b.vx*=.98;b.vz*=.98;}
 return p;
}
