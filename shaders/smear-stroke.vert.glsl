precision highp float;
attribute vec2 position;
attribute vec2 uvs;

// pass the color to the fragment shader
varying vec2 vUv;

uniform vec2 scale;
uniform vec2 translation;
uniform float rot;
uniform mat4 projection;

// angle in radians
mat2 rotate2d(float _angle){
	return mat2(cos(_angle),-sin(_angle),
				sin(_angle),cos(_angle));
}
void main() {
	vUv = uvs;

	vec2 p = position * scale;
	p = rotate2d(rot) * p;
	p += translation;
	
	gl_Position = projection * vec4(p, 0.0, 1.0);
}