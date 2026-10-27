import test from 'node:test';
import assert from 'node:assert/strict';
import {bindControls} from '../src/controls.js';
class Button extends EventTarget {
 classList={toggle(){},remove(){}};
 setPointerCapture(id){this.captured=id;}
 send(type,id){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,pointerType:'touch'});this.dispatchEvent(e);return e;}
}
test('independent fingers, repeated presses, cancellation and release never latch input',()=>{
 const elements=Object.fromEntries(['left','right','throttle'].map(k=>[k,new Button()]));
 const {input,setInput,release}=bindControls(elements);
 elements.throttle.send('pointerdown',1);elements.left.send('pointerdown',2);
 assert.equal(input.throttle,true);assert.equal(input.left,true);assert.equal(elements.left.captured,2);
 elements.left.send('pointercancel',2);assert.equal(input.left,false);assert.equal(input.throttle,true);
 elements.right.send('pointerdown',3);elements.right.send('pointerdown',4);elements.right.send('pointerup',3);assert.equal(input.right,true);
 elements.right.send('lostpointercapture',4);assert.equal(input.right,false);
 setInput('throttle','w',true);elements.throttle.send('pointerup',1);assert.equal(input.throttle,true);
 release();assert.deepEqual(input,{left:false,right:false,throttle:false});
 for(let i=0;i<20;i++){assert.equal(elements.left.send('pointerdown',i).defaultPrevented,true);elements.left.send('pointerup',i);assert.equal(input.left,false);}
});

test('holding or adding a finger cannot provoke a double press',()=>{const elements=Object.fromEntries(['left','right','throttle'].map(k=>[k,new Button()]));let presses=0;bindControls(elements,()=>presses++);elements.throttle.send('pointerdown',1);elements.throttle.send('pointerdown',2);assert.equal(presses,1);elements.throttle.send('pointerup',1);elements.throttle.send('pointerup',2);elements.throttle.send('pointerdown',3);assert.equal(presses,2);});
