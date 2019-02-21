precision highp float;
attribute vec2 position;
attribute vec2 scale;
attribute vec2 translation;
attribute float rot;
attribute vec4 color;
attribute vec4 hsva;
attribute vec2 uvs;
attribute float stampOpacity;

// pass the color to the fragment shader
varying vec2 vUv;
varying vec4 vColor;
varying vec4 vHsva_offset;
varying float vStampOpacity;

uniform mat4 projection;

// angle in radians
mat2 rotate2d(float _angle){
	return mat2(cos(_angle),-sin(_angle),
				sin(_angle),cos(_angle));
}
void main() {
	vUv = uvs;
	vColor = color;
	vHsva_offset = hsva;
	vStampOpacity = stampOpacity;

	vec2 p = position * scale;
	p = rotate2d(rot) * p;
	p += translation;
	
	gl_Position = projection * vec4(p, 0.0, 1.0);
}