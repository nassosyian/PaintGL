precision highp float;

#pragma glslify: hsv2rgb = require('glsl-hsv2rgb')
// vec3 hsv2rgb(vec3 c) {
// 	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
// 	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
// 	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
// }

varying vec2 vUv;
uniform vec4 color;
uniform vec2 uResolution;
uniform sampler2D tex;
// uniform sampler2D bg;
void main() {
	vec4 txColor = texture2D(tex, vUv);
	
	vec4 clr = color*txColor;
	gl_FragColor = clr;
}