// One registry supplies the integrator, hull motion, settings validation and Lab.
const control=(group,label,value,min,max,step,unit,description,physical=true)=>({group,label,value,min,max,step,unit,description,physical});
export const physicsControls={
 top:control('Propulsion & Throttle','Top-speed target',85,85,180,1,' km/h','Sets the nominal full-throttle drag curve.'),
 maxThrust:control('Propulsion & Throttle','Maximum thrust',13650,4000,26000,50,' N','Full-pump thrust for the 650 kg racing hull.'),
 pumpResponse:control('Propulsion & Throttle','Throttle response',.12,.03,.5,.01,' s','Pump pressure rise time; lower responds faster.'),
 pumpDecay:control('Propulsion & Throttle','Throttle release',.16,.03,.6,.01,' s','Pressure decay after lifting off the throttle.'),
 acceleration:control('Propulsion & Throttle','Acceleration strength',21,15,28,.5,'','Scales thrust from the nominal 21 m/s² tune.'),
 forwardDrag:control('Propulsion & Throttle','Forward water drag',1,.4,2,.05,'×','Longitudinal resistance and coasting deceleration.'),
 steer:control('Steering & Waterjet','Steering responsiveness',75,20,100,1,'%','Retained legacy response and torque multiplier.'),
 nozzleAuthority:control('Steering & Waterjet','Nozzle travel',30,10,45,1,'°','Maximum stern jet-vector angle.'),
 lowSpeedSteering:control('Steering & Waterjet','Low-speed steering authority',1,.25,1.75,.05,'×','Powered steering after the hull starts moving.'),
 highSpeedSteering:control('Steering & Waterjet','High-speed steering authority',1,.25,1.75,.05,'×','Steering authority near the top-speed target.'),
 throttleOffSteering:control('Steering & Waterjet','Throttle-off steering authority',0,0,.25,.01,'','Optional coasting assist; zero gives power-only steering.'),
 jetSteeringResponse:control('Steering & Waterjet','Jet steering response',12,3,24,.5,' /s','How quickly the nozzle follows steering input.'),
 bankIntensity:control('Banking & Roll','Banking intensity',1,0,2.5,.05,'×','Scales measured lateral-force banking.',false),
 maxBankAngle:control('Banking & Roll','Maximum bank angle',9,0,25,.5,'°','Bounds actual roll, including overshoot and rocking.',false),
 bankResponse:control('Banking & Roll','Banking response speed',9,3,18,.5,' /s','Roll spring response while loading the hull.',false),
 bankRecovery:control('Banking & Roll','Banking recovery speed',6,2,16,.5,' /s','Roll spring response while settling upright.',false),
 bankDamping:control('Banking & Roll','Banking damping',.95,.4,2,.05,'','Roll damping ratio; higher settles without ringing.',false),
 bankOvershoot:control('Banking & Roll','Banking overshoot',.15,0,1,.05,'','Allows a small, bounded spring overshoot.',false),
 turnPitch:control('Banking & Roll','Turn-induced pitch',.6,0,3,.1,'°','Small bow response to actual cornering load.',false),
 bowLift:control('Planing & Pitch','Bow lift intensity',4,0,10,.25,'°','Planing bow angle and acceleration lift.',false),
 planingSpeed:control('Planing & Pitch','Planing speed threshold',25,10,60,1,' km/h','Center of the displacement-to-planing transition.'),
 planingSmoothness:control('Planing & Pitch','Planing transition smoothness',.4,.1,.9,.05,'','Width of the speed transition; higher is more gradual.'),
 pitchDamping:control('Planing & Pitch','Pitch damping',1,.4,2,.05,'','Damping ratio of the visual pitch spring.',false),
 decelerationPitch:control('Planing & Pitch','Deceleration pitch response',1.8,0,5,.1,'°','How much the bow settles under deceleration.',false),
 drift:control('Drift & Hull Grip','Lateral drift intensity',65,0,100,1,'%','Retained drift setting; higher keeps lateral momentum.'),
 hullGrip:control('Drift & Hull Grip','Hull grip',1,.35,1.8,.05,'×','Speed-dependent resistance across the hull.'),
 driftRecovery:control('Drift & Hull Grip','Drift recovery',.65,0,2,.05,'','Extra stabilization as the nozzle returns to center.'),
 lateralResistance:control('Drift & Hull Grip','Lateral water resistance',8,1,15,.5,' /s','Hydrodynamic damping of sideways velocity.'),
 corneringLoss:control('Drift & Hull Grip','Cornering speed loss',.25,0,1,.05,'','Additional forward resistance during a loaded slide.'),
 spinoutSensitivity:control('Drift & Hull Grip','Spinout sensitivity',0,0,1,.05,'','Optional yaw instability under excessive slip; zero disables it.'),
 yawInertia:control('Drift & Hull Grip','Yaw inertia',1,.5,2.5,.05,'×','Rotational inertia around the 1,500 kg·m² reference.'),
 yawDamping:control('Drift & Hull Grip','Yaw damping',4.5,1.5,10,.1,' /s','Water resistance to rotation after a steering correction.'),
 bounceIntensity:control('Bounce & Water Interaction','Hull bounce intensity',.04,0,.15,.005,' m','Response scale for sampled waves; calm water stays calm.',false),
 verticalDamping:control('Bounce & Water Interaction','Vertical damping',1,.4,2,.05,'','Damping ratio of vertical hull motion.',false),
 waterImpactResponse:control('Bounce & Water Interaction','Water impact response',.7,0,2,.05,'×','Damped response to wave encounters and bank impacts.',false),
 hullRocking:control('Bounce & Water Interaction','Hull rocking',.35,0,2,.05,'×','Small roll and pitch from the sampled water slope.',false),
 wakeSensitivity:control('Bounce & Water Interaction','Wake sensitivity',.6,0,2,.05,'×','Response to historical wake disturbances.',false)
};
export const physicsKeys=Object.freeze(Object.keys(physicsControls));
export const forceKeys=Object.freeze(physicsKeys.filter(k=>physicsControls[k].physical));
export const handlingDefaults=Object.freeze({...Object.fromEntries(physicsKeys.map(k=>[k,physicsControls[k].value])),invertBank:false});
export const handlingKeys=Object.freeze([...physicsKeys,'invertBank']);
export const physicsGroups=Object.freeze([...new Set(Object.values(physicsControls).map(c=>c.group))]);
export const handlingProfiles={
 balanced:{...handlingDefaults},
 arcade:{...handlingDefaults,pumpResponse:.08,lowSpeedSteering:1.1,drift:55,hullGrip:1.1,driftRecovery:1.25,yawInertia:.8,yawDamping:5.2,maxBankAngle:7.5,bankDamping:1.1},
 simulation:{...handlingDefaults,pumpResponse:.2,pumpDecay:.23,lowSpeedSteering:.85,forwardDrag:1.15,drift:72,hullGrip:.9,driftRecovery:.15,lateralResistance:9,corneringLoss:.4,spinoutSensitivity:.2,yawInertia:1.35,yawDamping:3.8,maxBankAngle:10,bowLift:5}
};
export const presetName={balanced:'Balanced',arcade:'Arcade',simulation:'Simulation-Inspired',custom:'Custom'};
export function identifyHandling(values){return Object.keys(handlingProfiles).find(name=>handlingKeys.every(k=>values[k]===handlingProfiles[name][k]))||'custom';}
export function planingFactor(speed,tuning=handlingDefaults){
 const threshold=tuning.planingSpeed/3.6,width=tuning.planingSmoothness;
 const t=Math.max(0,Math.min(1,(speed-threshold*(1-width))/(threshold*2*width)));
 return t*t*(3-2*t);
}
