import {V8Core} from './v8-core.js';
class V8Processor extends AudioWorkletProcessor {
 constructor(options){super();this.core=new V8Core(sampleRate,options.processorOptions.settings);this.port.onmessage=({data})=>{if(data.settings)this.core.configure(data.settings);if(Number.isFinite(data.rpm))this.core.setState(data.rpm,data.load||0);};}
 process(inputs,outputs){const out=outputs[0];this.core.render(out[0],out[1]||out[0]);return true;}
}
registerProcessor('jet-sprint-v8',V8Processor);
