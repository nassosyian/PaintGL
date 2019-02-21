#extension GL_EXT_frag_depth : enable
precision highp float;

uniform sampler2D depthLess;
uniform sampler2D depthGreater;
varying vec2 uv;
void main() {
	vec4 a = texture2D(depthLess, uv);
	vec4 b = texture2D(depthGreater, uv);
	vec4 clr;

	gl_FragDepthEXT = (a.r + b.r)*0.5;
	gl_FragColor = vec4(1.0);
}