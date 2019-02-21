#extension GL_EXT_draw_buffers : require
#extension GL_EXT_frag_depth : enable
#extension GL_EXT_shader_texture_lod: enable
#extension GL_OES_standard_derivatives : enable

precision highp float;

uniform mat4 model, view, projection;

varying vec2 vUv;
varying float camDepth;
varying float camW;

varying vec3 vP;
varying vec4 vP4;
varying vec3 vPmodel;
// varying vec3 vN;
varying vec3 vEye;

uniform sampler2D colorTex;
// uniform sampler2D normalTex;
uniform sampler2D metallicTex;
uniform sampler2D roughnessTex;
uniform sampler2D emissiveTex;
uniform float Fcoef;
uniform vec2 uNearFar;


vec3 calcT(vec3 N)
{
	vec3 pos_dx = dFdx(vP);
	vec3 pos_dy = dFdy(vP);
	vec3 tex_dx = dFdx(vec3(vUv, 0.0));
	vec3 tex_dy = dFdy(vec3(vUv, 0.0));
	vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);
	t = normalize(t - N * dot(N, t));

	return t;
}

void main() {
	vec4 clr = texture2D(colorTex, vUv);
	gl_FragData[0] = (clr);
	
	// viewerMetallicTex
	gl_FragData[1] = texture2D(metallicTex, vUv);
	
	// viewerRoughnessTex
	gl_FragData[2] = texture2D(roughnessTex, vUv);
	
	// viewerEmissiveColorTex
	gl_FragData[3] = texture2D(emissiveTex, vUv);

	gl_FragDepthEXT = log2(camW) * Fcoef*0.5;
}