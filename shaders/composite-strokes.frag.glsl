#extension GL_EXT_shader_texture_lod: enable
#extension GL_OES_standard_derivatives : enable

precision highp float;
uniform sampler2D bg;
uniform sampler2D fg;
uniform sampler2D colorTex;
uniform sampler2D geoWorldPosTex;
uniform sampler2D geoNormalTex;
uniform sampler2D geoTangentTex;
uniform sampler2D normalTex;
uniform sampler2D metallicRoughnessTex;
uniform sampler2D emissiveTex;
uniform sampler2D depthTex;
uniform sampler2D aoTex;
uniform mat4 u_InverseMVP;
// uniform sampler2D depth;
uniform float aoScale;
varying vec2 uv;

vec2 encodeNormalToVec2 (in vec3 n)
{
	float p = sqrt(n.z*8.0+8.0);
	return (n.xy/p + 0.5);
}

vec3 decodeVec2ToNormal (in vec2 enc)
{
	vec2 fenc = enc.xy*4.0 - 2.0;
	float f = dot(fenc, fenc);
	float g = sqrt(1.0 - f/4.0);
	vec3 n;
	n.xy = fenc*g;
	n.z = 1.0 - f/2.0;
	return n;
}

vec2 encodeNormFloatTo16bit(float num)
{
	float high = floor(65535.0 * (num*0.5 + 0.5));
	float low = high;
	high = floor(high / 256.0);
	// low = mod(low, 256.0);
	low = floor(low - high*256.0);
	return (vec2(high, low) / 255.0);
}

float decode16bitToNormFloat(vec2 v)
{
	return ((v.x*65535.0 + v.y*255.0)/65535.0)*2.0 - 1.0;
}

vec4 encodeNormalToRGBA8(vec3 N)
{
	vec2 n2 = encodeNormalToVec2(N);
	return vec4(encodeNormFloatTo16bit(n2.x), encodeNormFloatTo16bit(n2.y));
}

vec3 decodeRGBA8ToNormal(vec4 clr)
{
	vec2 n2 = vec2( decode16bitToNormFloat(clr.xy), decode16bitToNormFloat(clr.zw) );
	vec3 N = decodeVec2ToNormal(n2);
	return N;
}



void main() {
	vec4 bgClr = texture2D(colorTex, uv);
	vec4 fgClr = texture2D(fg, uv);
	vec4 clr;
	float ao = texture2D(aoTex, uv).r;

	ao = 1.0 - ao * aoScale;

	vec3 N = decodeRGBA8ToNormal( texture2D(geoNormalTex, uv) );
	vec3 T = decodeRGBA8ToNormal( texture2D(geoTangentTex, uv) );
	vec2 metalRough = texture2D(metallicRoughnessTex, uv).xy;
	vec4 emissveClr = texture2D(emissiveTex, uv);

	clr.rgb = mix(bgClr.rgb, fgClr.rgb, fgClr.a);
	clr.a = 1.0;

	gl_FragColor = vec4(clr.rgb * ao, clr.a);

	clr = texture2D(geoWorldPosTex, uv);
	gl_FragColor = vec4(mod(clr.rgb, 1.0), 1.0);
}