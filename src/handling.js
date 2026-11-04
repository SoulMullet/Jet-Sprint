// One registry supplies the integrator, hull motion, settings validation and Lab.
const control=(group,label,value,min,max,step,unit,description,physical=true)=>({group,label,value,min,max,step,unit,description,physical});
export const physicsControls={
 top:control('Propulsion & Throttle','Archived replay speed target',85,85,180,1,' km/h','Preserved for old replays; career stock speed is configured in Development / career performance.'),
 maxThrust:control('Propulsion & Throttle','Maximum thrust',13650,4000,26000,50,' N','Full-pump thrust for the 650 kg racing hull.'),
 pumpResponse:control('Propulsion & Throttle','Throttle response',.07,.03,.5,.01,' s','Pump pressure rise time; lower responds faster.'),
 pumpDecay:control('Propulsion & Throttle','Pump pressure release',.08,.03,.6,.01,' s','Pressure memory after lift-off; released throttle produces zero thrust immediately.'),
 acceleration:control('Propulsion & Throttle','Nominal acceleration strength',24,15,28,.5,' m/s²','Scales thrust from the nominal 21 m/s² tune.'),
 forwardDrag:control('Propulsion & Throttle','Forward water drag',1,.4,2,.05,'×','Longitudinal resistance and coasting deceleration.'),
 maxTurnRate:control('Steering & Waterjet','Maximum turn rate',150,45,220,5,' °/s','Speed-gated yaw ceiling. A stopped hull cannot spin.'),
 lowSpeedAssist:control('Steering & Waterjet','Low-speed steering assistance',.65,0,1,.05,'×','Adds moving-hull yaw assistance below 12 m/s, including while coasting. No extra forward thrust.'),
 offThrottleDrag:control('Propulsion & Throttle','Off-throttle water drag',.22,0,1.2,.02,' /s','Extra water resistance while throttle is released; velocity coasts rather than snapping to zero.'),
 steer:control('Steering & Waterjet','Steering responsiveness',95,20,100,1,'%','Retained legacy response and torque multiplier.'),
 nozzleAuthority:control('Steering & Waterjet','Nozzle travel',35,10,45,1,'°','Maximum stern jet-vector angle.'),
 lowSpeedSteering:control('Steering & Waterjet','Low-speed steering authority',1.4,.25,1.75,.05,'×','Powered steering after the hull starts moving.'),
 highSpeedSteering:control('Steering & Waterjet','High-speed steering authority',1.3,.25,1.75,.05,'×','Steering authority near the top-speed target.'),
 throttleOffSteering:control('Steering & Waterjet','Throttle-off steering authority',.16,0,.25,.01,'','Optional coasting assist; zero gives power-only steering.'),
 jetSteeringResponse:control('Steering & Waterjet','Jet steering response',22,3,24,.5,' /s','How quickly the nozzle follows steering input.'),
 bankIntensity:control('Banking & Roll','Banking intensity',1.05,0,2.5,.05,'×','Scales measured lateral-force banking.',false),
 maxBankAngle:control('Banking & Roll','Maximum bank angle',11,0,25,.5,'°','Bounds actual roll, including overshoot and rocking.',false),
 bankResponse:control('Banking & Roll','Banking response speed',12,3,18,.5,' /s','Roll spring response while loading the hull.',false),
 bankRecovery:control('Banking & Roll','Banking recovery speed',8,2,16,.5,' /s','Roll spring response while settling upright.',false),
 bankDamping:control('Banking & Roll','Banking damping',1.05,.4,2,.05,'','Roll damping ratio; higher settles without ringing.',false),
 bankOvershoot:control('Banking & Roll','Banking overshoot',.15,0,1,.05,'','Allows a small, bounded spring overshoot.',false),
 turnPitch:control('Banking & Roll','Turn-induced pitch',.6,0,3,.1,'°','Small bow response to actual cornering load.',false),
 bowLift:control('Planing & Pitch','Bow lift intensity',4,0,10,.25,'°','Planing bow angle and acceleration lift.',false),
 planingSpeed:control('Planing & Pitch','Planing speed threshold',25,10,60,1,' km/h','Center of the displacement-to-planing transition.'),
 planingSmoothness:control('Planing & Pitch','Planing transition smoothness',.4,.1,.9,.05,'','Width of the speed transition; higher is more gradual.'),
 pitchDamping:control('Planing & Pitch','Pitch damping',1,.4,2,.05,'','Damping ratio of the visual pitch spring.',false),
 decelerationPitch:control('Planing & Pitch','Deceleration pitch response',1.8,0,5,.1,'°','How much the bow settles under deceleration.',false),
 drift:control('Drift & Hull Grip','Lateral drift intensity',35,0,100,1,'%','Retained drift setting; higher keeps lateral momentum.'),
 hullGrip:control('Drift & Hull Grip','Hull grip',1.35,.35,1.8,.05,'×','Speed-dependent resistance across the hull.'),
 driftRecovery:control('Drift & Hull Grip','Drift recovery',1.2,0,2,.05,'','Extra stabilization as the nozzle returns to center.'),
 lateralResistance:control('Drift & Hull Grip','Lateral water resistance',12,1,15,.5,' /s','Hydrodynamic damping of sideways velocity.'),
 corneringLoss:control('Drift & Hull Grip','Cornering speed loss',.25,0,1,.05,'','Additional forward resistance during a loaded slide.'),
 spinoutSensitivity:control('Drift & Hull Grip','Spinout sensitivity',0,0,1,.05,'','Optional yaw instability under excessive slip; zero disables it.'),
 yawInertia:control('Drift & Hull Grip','Yaw inertia',.65,.5,2.5,.05,'×','Rotational inertia around the 1,500 kg·m² reference.'),
 yawDamping:control('Drift & Hull Grip','Yaw damping',6.5,1.5,10,.1,' /s','Water resistance to rotation after a steering correction.'),
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
// Recognition data for factory saves only. Explicit/custom imports retain their values.
export const HANDLING_REVISION='hold-arcade-v1';
const previousDefaults={...handlingDefaults,pumpResponse:.12,pumpDecay:.16,acceleration:21,steer:75,nozzleAuthority:30,lowSpeedSteering:1,highSpeedSteering:1,throttleOffSteering:0,jetSteeringResponse:12,bankIntensity:1,maxBankAngle:9,bankResponse:9,bankRecovery:6,bankDamping:.95,drift:65,hullGrip:1,driftRecovery:.65,lateralResistance:8,yawInertia:1,yawDamping:4.5};
const previousArcade={...previousDefaults,pumpResponse:.08,lowSpeedSteering:1.1,drift:55,hullGrip:1.1,driftRecovery:1.25,yawInertia:.8,yawDamping:5.2,maxBankAngle:7.5,bankDamping:1.1};
const previousSimulation={...previousDefaults,pumpResponse:.2,pumpDecay:.23,lowSpeedSteering:.85,forwardDrag:1.15,drift:72,hullGrip:.9,driftRecovery:.15,lateralResistance:9,corneringLoss:.4,spinoutSensitivity:.2,yawInertia:1.35,yawDamping:3.8,maxBankAngle:10,bowLift:5};
export const handlingProfiles={
 arcade:{...handlingDefaults},
 balanced:{...previousDefaults,maxTurnRate:180,lowSpeedAssist:.25,offThrottleDrag:.1},
 simulation:{...previousSimulation,maxTurnRate:220,lowSpeedAssist:0,offThrottleDrag:0}
};
export function upgradeFactoryHandling(values, saved) {
 if(saved.handlingRevision===HANDLING_REVISION)return '';
 const raw=saved.settings??saved.values??{},name=raw.physicsPreset,
  previous={balanced:previousDefaults,arcade:previousArcade,simulation:previousSimulation}[name];
 if(!previous)return '';
 const oldKeys=handlingKeys.filter(k=>!['maxTurnRate','lowSpeedAssist','offThrottleDrag'].includes(k));
 if(!oldKeys.every(k=>Object.hasOwn(raw,k)&&raw[k]===previous[k]))return '';
 Object.assign(values,name==='simulation'?handlingProfiles.simulation:handlingProfiles.arcade);
 values.physicsPreset=name==='simulation'?'simulation':'arcade';
 return name==='simulation'?'Simulation tune retained; new arcade assists disabled.':'Factory handling updated to responsive Arcade. Custom tuning and other saves are retained.';
}
export const presetName={balanced:'Balanced',arcade:'Arcade',simulation:'Simulation-Inspired',custom:'Custom'};
export function identifyHandling(values){return Object.keys(handlingProfiles).find(name=>handlingKeys.every(k=>values[k]===handlingProfiles[name][k]))||'custom';}
export function planingFactor(speed,tuning=handlingDefaults){
 const threshold=tuning.planingSpeed/3.6,width=tuning.planingSmoothness;
 const t=Math.max(0,Math.min(1,(speed-threshold*(1-width))/(threshold*2*width)));
 return t*t*(3-2*t);
}
