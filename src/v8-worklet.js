import {V8Synth} from './v8-dsp.js';
import {defaultAudio} from './audio-settings.js';
class V8Processor extends AudioWorkletProcessor {
 constructor(){super();this.synth=new V8Synth(sampleRate,defaultAudio());this.rpm=900;this.load=0;this.overrun=0;
  this.port.onmessage=({data})=>{if(data.settings)this.synth.configure(data.settings);if(Number.isFinite(data.rpm))this.rpm=data.rpm;if(Number.isFinite(data.load))this.load=data.load;if(Number.isFinite(data.overrun))this.overrun=data.overrun;};
 }
 process(inputs,outputs){const out=outputs[0];if(out?.length===2)this.synth.render(out[0],out[1],this.rpm,this.load,this.overrun);return true;}
}
registerProcessor('jetsprint-v8',V8Processor);
