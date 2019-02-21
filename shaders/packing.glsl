
vec3 packNormalToRGB( in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}

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

// #pragma glslify: export(encodeNormFloatTo16bit)
// #pragma glslify: export(decode16bitToNormFloat)

// #pragma glslify: export(encodeNormalToRGBA8)
// #pragma glslify: export(decodeRGBA8ToNormal)