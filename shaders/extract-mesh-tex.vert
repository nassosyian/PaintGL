precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 model, view, projection, uNormalMatrix;
uniform float Fcoef;

varying vec2 vUv;
varying vec4 vPos;
varying vec3 vN;
varying vec3 vEye;
// varying vec3 vNormal;

void main() {
	vUv = uv;

	vN = (uNormalMatrix * vec4(normal, 1)).xyz;

	vec4 p = (view * model * vec4(position, 1));
	vEye = p.xyz;
	p = (projection * p);
	p.z = log2(max(1e-6, 1.0 + p.w)) * Fcoef - 1.0;
	vPos = vec4(p.xyz / p.w, p.w);
	vPos.w = 1.0 + vPos.w;
	gl_Position = vec4(uv*2.0 - 1.0, 0.0, 1.0);
}