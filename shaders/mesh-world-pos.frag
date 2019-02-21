#extension GL_EXT_draw_buffers : require
#extension GL_EXT_frag_depth : enable
#extension GL_EXT_shader_texture_lod: enable
#extension GL_OES_standard_derivatives : enable
precision highp float;

varying vec2 vUv;
varying vec3 vP;
varying vec3 vN;


varying float camDepth;
varying float camW;
uniform float Fcoef;
// uniform vec2 uNearFar;
uniform sampler2D normalTex;

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
	gl_FragData[0] = vec4(vP, 1.0);

	gl_FragDepthEXT = log2(camW) * Fcoef*0.5;
	// gl_FragDepthEXT = log2(camW) * Fcoef*0.2;

	vec3 N = (normalize( vN ) + 1.0)*0.5;
	vec3 T = (calcT(N) + 1.0)*0.5;
	
	// viewerGeomNTex
	// gl_FragData[1] = encodeNormalToRGBA8(N);
	gl_FragData[1] = vec4(N, 1.0);
	
	// viewerGeomTTex
	// gl_FragData[2] = encodeNormalToRGBA8(T);
	gl_FragData[2] = vec4(T, 1.0);
	
	// viewernormalTex
	// gl_FragData[3] = encodeNormalToRGBA8(vec3(0.0));
	// gl_FragData[3] = encodeNormalToRGBA8(texture2D(normalTex, vUv).rgb);
	gl_FragData[3] = texture2D(normalTex, vUv);
}