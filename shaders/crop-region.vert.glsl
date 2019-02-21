precision highp float;
attribute vec2 position;
attribute vec2 uvs;
varying vec2 uv;

// uniform vec2 scale;
uniform vec2 translation;
uniform vec2 size;
uniform float rot;

// angle in radians
mat2 rotate2d(float _angle){
	return mat2(cos(_angle),-sin(_angle),
				sin(_angle),cos(_angle));
}

void main() {
	uv = uvs;

	vec2 p = 0.5 * (position + 1.0);
	p = p - (translation );//- 0.5*size);
	p = rotate2d( -(rot) )*p;
	p /= size;
	p += 0.5;
	gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0);
}