precision highp float;
attribute vec2 position;
attribute vec2 uvs;

// pass the color to the fragment shader
varying vec2 vUv;
varying vec4 vColor;

uniform vec2 scale;
uniform vec2 translation;
uniform float rot;
uniform vec4 color;
uniform mat4 projection;

// angle in radians
mat2 rotate2d(float _angle){
	return mat2(cos(_angle),-sin(_angle),
				sin(_angle),cos(_angle));
}
void main() {
	vUv = uvs;
	vColor = color;

	vec2 p = position * scale*2.0;
	p = rotate2d(rot) * p;
	p += (translation);
	
	gl_Position = projection * vec4(p, 0.0, 1.0);
}