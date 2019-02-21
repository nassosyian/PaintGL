precision highp float;
attribute vec3 position;
attribute vec2 uv;

uniform mat4 model, view, projection;
uniform float Fcoef;
varying vec2 vUv;
varying float camDepth;
varying float camW;
void main() {
	vUv = uv;
	gl_Position = projection * view * model * vec4(position, 1);
	gl_Position.z = log2(max(1e-6, 1.0 + gl_Position.w)) * Fcoef - 1.0;

	camDepth = gl_Position.z;
	// camW = gl_Position.w;
	camW = 1.0 + gl_Position.w;
	// gl_Position = vec4(uv*2.0 - 1.0, 0.0, 1.0);
}