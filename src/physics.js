export const settings = { top:85, drift:65, steer:75 };
export const course = [[0, -35],[25,-34],[37,-19],[25,-3],[35,15],[23,33],[0,36],[-27,30],[-36,12],[-22,-2],[-34,-20],[-23,-34]];
export function stepBoat(b, input, dt, nearest) {
 const forward={x:Math.cos(b.angle),z:Math.sin(b.angle)};
 const speed=Math.hypot(b.vx,b.vz), max=settings.top/3.6;
 const steer=(Number(!!input.right)-Number(!!input.left));
 b.angle+=steer*(settings.steer/75)*1.65*(.18+Math.min(speed/10,1)*.82)*dt;
 if(input.throttle){b.vx+=forward.x*15*dt;b.vz+=forward.z*15*dt;}
 const lateral=-b.vx*forward.z+b.vz*forward.x;
 const grip=7-(settings.drift/100)*5.8;
 b.vx+=forward.z*lateral*Math.min(1,grip*dt);b.vz-=forward.x*lateral*Math.min(1,grip*dt);
 const drag=.12+speed*speed*(15-.12*max)/(max*max*max);
 b.vx*=Math.exp(-drag*dt);b.vz*=Math.exp(-drag*dt);
 b.x+=b.vx*dt;b.z+=b.vz*dt;
 const p=nearest(b.x,b.z), dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);
 if(d>5.2){const nx=dx/d,nz=dz/d;b.x=p.x+nx*5.2;b.z=p.z+nz*5.2;const outward=b.vx*nx+b.vz*nz;if(outward>0){b.vx-=outward*1.35*nx;b.vz-=outward*1.35*nz;}b.vx*=.98;b.vz*=.98;}
 return p;
}
