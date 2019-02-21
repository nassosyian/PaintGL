precision highp float;
#define GLSLIFY 1

// vec3 hsv2rgb(vec3 c) {
//   vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
//   vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
//   return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
// }

// vec3 hsv2rgb(vec3 c) {
// 	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
// 	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
// 	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
// }

vec3 rgb2hsv(vec3 c)
{
	vec4 k = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, k.wz), vec4(c.gb, k.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
	vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
	return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
}

varying vec2 vUv;
varying vec4 vColor;
varying vec4 vHsva_offset;
varying float vStampOpacity;
uniform sampler2D tex;
void main() {
	vec4 txColor = texture2D(tex, vUv);
	
	vec2 center = vec2(0.5,0.5);
	float distanceFromCenter = length(vUv - center);

	float gray = dot(txColor.rgb, vec3(0.299, 0.587, 0.114))*txColor.a;
	vec3 hsv = rgb2hsv(vColor.rgb) + vHsva_offset.rgb;
	hsv = vec3( mod(hsv.r, 1.0), clamp(hsv.g, 0.0, 1.0), clamp(hsv.b, 0.0, 1.0) );
	vec4 clr = vec4(hsv2rgb(hsv), vColor.a*gray);
	
	clr.a *= vStampOpacity;// 0.1;

	gl_FragColor = clr;
}