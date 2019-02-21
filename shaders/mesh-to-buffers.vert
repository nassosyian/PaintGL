precision highp float;
attribute vec3 position;
// attribute vec3 normal;
attribute vec2 uv;
// attribute float occlusion;

uniform mat4 model, view, projection;
uniform mat4 uNormalMatrix;
uniform float Fcoef;
varying vec2 vUv;
varying float camDepth;
varying float camW;

varying vec3 vP;
varying vec4 vP4;
varying vec3 vPmodel;
// varying vec3 vN;
varying vec3 vEye;

void main() {
	vUv = uv;
	vPmodel = (model * vec4(position, 1.0)).xyz;
	vec4 p = (view * model * vec4(position, 1.0));
	vEye = p.xyz;
	p = (projection * p);

	gl_Position = p;
	vP4 = p;
	vP4 = (projection * view * model * vec4(position, 1.0));
	vP = p.xyz / p.w;
	gl_Position.z = log2(max(1e-6, 1.0 + gl_Position.w)) * Fcoef - 1.0;

	camDepth = gl_Position.z;
	// camW = gl_Position.w;
	camW = 1.0 + gl_Position.w;
	// gl_Position = vec4(uv*2.0 - 1.0, 0.0, 1.0);
}