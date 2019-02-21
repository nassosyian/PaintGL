#extension GL_EXT_frag_depth : enable
// #extension GL_OES_standard_derivatives : enable
precision highp float;

varying vec2 vUv;
varying float camDepth;
varying float camW;
uniform float Fcoef;
uniform vec2 uNearFar;
void main() {
	gl_FragDepthEXT = log2(camW) * Fcoef*0.5;

	gl_FragColor = vec4(vUv, 1.0, 1.0);
}