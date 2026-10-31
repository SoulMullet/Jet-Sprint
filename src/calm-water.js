// World-space, slowly advected aperiodic ripples. No tile-sized phase reset.
const fract = (x) => x - Math.floor(x),
  hash = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
function noise(x, z) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    a = x - ix,
    b = z - iz,
    u = a * a * (3 - 2 * a),
    v = b * b * (3 - 2 * b);
  return (
    (hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u) * (1 - v) +
    (hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u) * v
  );
}
export function calmHeight(x, z, time) {
  return (
    (noise(x * 0.045 + time * 0.012, z * 0.045 - time * 0.007) - 0.5) * 0.018 +
    (noise(x * 0.109 - time * 0.004, z * 0.109 + time * 0.006) - 0.5) * 0.008
  );
}
export const calmGLSL = `
float calmHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float calmNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(calmHash(i),calmHash(i+vec2(1.,0.)),f.x),mix(calmHash(i+vec2(0.,1.)),calmHash(i+vec2(1.)),f.x),f.y);}
float calmHeight(vec2 p,float t){return (calmNoise(p*.045+vec2(t*.012,-t*.007))-.5)*.018+(calmNoise(p*.109+vec2(-t*.004,t*.006))-.5)*.008;}
`;
