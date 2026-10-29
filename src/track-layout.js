// A single smooth figure-eight, with the crossover visited in two directions.
// Indices refer to ONE closed centripetal spline, preserving tangents at joins.
export const trackConfig=Object.freeze({
 id:'cedar-creek-figure-eight',version:3,seed:1988,fluidSize:192,sampleSpacing:1.4,
 spline:[[-36,-24],[-53,0],[-36,24],[0,0],[36,-24],[53,0],[36,24],[0,0]],
 nodes:{S:[-36,-24],W:[-53,0],J:[0,0],R:[53,0],K:[-76,-12]},
 edges:[
  {id:'S-W',from:'S',to:'W',start:0,end:1},
  {id:'W-J',from:'W',to:'J',start:1,end:3},
  {id:'J-R',from:'J',to:'R',start:3,end:5},
  {id:'R-J',from:'R',to:'J',start:5,end:7},
  {id:'J-S',from:'J',to:'S',start:7,end:8},
  {id:'staging',from:'W',to:'K',via:[[-66,-1],[-74,-6]]}
 ],
 route:['S-W','W-J','J-R','R-J','J-S']
});
// Test-only compatibility loop; the active venue is built in course.js.
export const outerSpline=trackConfig.spline;
