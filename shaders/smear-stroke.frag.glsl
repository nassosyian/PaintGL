precision highp float;
#define GLSLIFY 1

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// vec3 hsv2rgb(vec3 c) {
// 	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
// 	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
// 	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
// }

varying vec2 vUv;
uniform vec4 color;
uniform vec4 hsva;
uniform float stampOpacity;
uniform float rot;
uniform float lastrot;
uniform vec2 uResolution;
uniform sampler2D tex;
uniform sampler2D bgTex;
// uniform sampler2D bg;
void main() {
	vec4 txColor = texture2D(tex, vUv);
	vec4 bgColor = texture2D(bgTex, vec2( vUv.x, 1.0 - vUv.y) );
	
	vec2 center = vec2(0.5,0.5);
	float distanceFromCenter = length(vUv - center);

	float gray = dot(txColor.rgb, vec3(0.299, 0.587, 0.114))*txColor.a;
	vec4 clr = vec4(bgColor.rgb, color.a*gray);
	clr.a *= stampOpacity*stampOpacity*stampOpacity;// 0.1;
	gl_FragColor = clr;
}