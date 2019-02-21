precision highp float;
attribute vec2 position;
attribute vec2 uvs;

// pass the color to the fragment shader
varying vec2 vUv;
// varying vec4 vColor;

// angle in radians
mat2 rotate2d(float _angle){
	return mat2(cos(_angle),-sin(_angle),
				sin(_angle),cos(_angle));
}
void main() {
	vUv = uvs;
	// vColor = color;

	vec2 p = position;
	
	gl_Position =  vec4(p, 0.0, 1.0);
}