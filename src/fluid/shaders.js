import {fluidConfig} from './numerics.js';
// GLSL3 raw passes: nearest texelFetch, no float filtering dependency.
export const fullscreenVertex=`precision highp float;in vec3 position;void main(){gl_Position=vec4(position,1.);}`;
const common=`precision highp float;precision highp int;
uniform highp sampler2D stateMap;uniform highp sampler2D bedMap;uniform highp sampler2D drainMap;
uniform int gridSize;uniform float stepDt;uniform float cellSize;
out vec4 result;
const float gravity=${fluidConfig.gravity.toFixed(8)};const float dry=${fluidConfig.dry.toFixed(8)};
vec4 stateAt(ivec2 p){vec4 a=texelFetch(stateMap,p,0);return vec4(max(0.,a.r+a.a),a.gb,0.);}vec2 bedAt(ivec2 p){return texelFetch(bedMap,p,0).rg;}
bool inside(ivec2 p){return all(greaterThanEqual(p,ivec2(0)))&&all(lessThan(p,ivec2(gridSize)));}
// Return common conservative face flux in normal/tangent coordinates.
vec3 face(ivec2 p,ivec2 dir,out float correction,out ivec2 donorNeighbor){
 vec3 a=stateAt(p).rgb;vec2 za=bedAt(p);ivec2 q=p+dir;vec2 normal=vec2(dir),tangent=vec2(-dir.y,dir.x);
 bool wall=!inside(q);if(!wall)wall=bedAt(q).g<.5;
 vec3 b;float zb;
 if(wall){b=vec3(a.x,a.yz-2.*dot(a.yz,normal)*normal);zb=za.r;donorNeighbor=p;}
 else{b=stateAt(q).rgb;zb=bedAt(q).r;donorNeighbor=q;}
 float z=max(za.r,zb),ha=max(0.,a.x+za.r-z),hb=max(0.,b.x+zb-z);
 vec2 va=a.x>dry?a.yz/a.x:vec2(0.),vb=b.x>dry?b.yz/b.x:vec2(0.);
 float ua=dot(va,normal),ub=dot(vb,normal),ta=dot(va,tangent),tb=dot(vb,tangent);
 float sl=min(0.,min(ua-sqrt(gravity*ha),ub-sqrt(gravity*hb))),sr=max(0.,max(ua+sqrt(gravity*ha),ub+sqrt(gravity*hb)));
 vec3 U=vec3(ha,ha*ua,ha*ta),V=vec3(hb,hb*ub,hb*tb);
 vec3 F=vec3(U.y,U.y*ua+.5*gravity*ha*ha,U.y*ta),G=vec3(V.y,V.y*ub+.5*gravity*hb*hb,V.y*tb);
 correction=.5*gravity*(a.x*a.x-ha*ha);
 return sr-sl>1e-8?(sr*F-sl*G+sl*sr*(V-U))/(sr-sl):vec3(0.);
}
const ivec2 dirs[4]=ivec2[4](ivec2(1,0),ivec2(-1,0),ivec2(0,1),ivec2(0,-1));
`;
export const drainFragment=common+`void main(){ivec2 p=ivec2(gl_FragCoord.xy);if(bedAt(p).g<.5){result=vec4(1.);return;}float outgoing=0.,incoming=0.;for(int i=0;i<4;i++){float correction;ivec2 neighbor;float mass=face(p,dirs[i],correction,neighbor).x;outgoing+=max(0.,mass);incoming+=max(0.,-mass);}float alpha=min(1.,stateAt(p).r*cellSize/(stepDt*outgoing+1e-30));float beta=min(1.,max(0.,${fluidConfig.designDepth.toFixed(8)}-stateAt(p).r)*cellSize/(stepDt*incoming+1e-30));result=vec4(alpha,beta,0.,1.);}`;
export const stepFragment=common+`
uniform bool compensatedDepth;uniform vec4 injection;uniform vec3 impulse;uniform float domainSize;
void main(){ivec2 p=ivec2(gl_FragCoord.xy);if(bedAt(p).g<.5){result=vec4(0.);return;}
 vec3 U=stateAt(p).rgb;vec2 limits=texelFetch(drainMap,p,0).rg;
 for(int i=0;i<4;i++){float correction;ivec2 neighbor;vec3 flux=face(p,dirs[i],correction,neighbor);vec2 otherLimits=texelFetch(drainMap,neighbor,0).rg;float factor=flux.x>=0.?min(limits.r,otherLimits.g):min(otherLimits.r,limits.g);flux*=factor;flux.y+=correction;vec2 normal=vec2(dirs[i]);vec2 tangent=vec2(-dirs[i].y,dirs[i].x);U-=stepDt/cellSize*vec3(flux.x,flux.y*normal+flux.z*tangent);}
 U.x=max(0.,U.x);
 vec2 world=(vec2(p)+.5)*cellSize-domainSize*.5,delta=world-injection.xy;
 if(injection.w>.5&&length(delta)<injection.z*3.){float r=length(delta);vec2 direction=r>.0001?delta/r:vec2(0.);U.yz+=U.x*exp(-r*r/(2.*injection.z*injection.z))*(impulse.xy+direction*impulse.z);}
 U.yz/=1.+${fluidConfig.friction.toFixed(8)}*stepDt;float speed=length(U.yz)/max(dry,U.x);U.yz*=min(1.,${fluidConfig.maxSpeed.toFixed(8)}/max(speed,1e-20));if(U.x<dry)U.yz=vec2(0.);if(compensatedDepth){float hi=unpackHalf2x16(packHalf2x16(vec2(U.x,0.))).x;result=vec4(hi,U.yz,U.x-hi);}else result=vec4(U,0.);
}`;
export const copyFragment=`precision highp float;uniform highp sampler2D initialMap;out vec4 result;void main(){result=texelFetch(initialMap,ivec2(gl_FragCoord.xy),0);}`;
