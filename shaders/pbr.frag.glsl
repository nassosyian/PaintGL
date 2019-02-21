//
// This fragment shader defines a reference implementation for Physically Based Shading of
// a microfacet surface material defined by a glTF model.
//
// References:
// [1] Real Shading in Unreal Engine 4
//     http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
// [2] Physically Based Shading at Disney
//     http://blog.selfshadow.com/publications/s2012-shading-course/burley/s2012_pbs_disney_brdf_notes_v3.pdf
// [3] README.md - Environment Maps
//     https://github.com/KhronosGroup/glTF-WebGL-PBR/#environment-maps
// [4] "An Inexpensive BRDF Model for Physically based Rendering" by Christophe Schlick
//     https://www.cs.virginia.edu/~jdl/bib/appearance/analytic%20models/schlick94b.pdf
#extension GL_EXT_shader_texture_lod: enable
// #extension GL_OES_standard_derivatives : enable

precision highp float;

uniform vec3 u_LightDirection;
uniform vec3 u_LightColor;

uniform vec2 pixelStep;

uniform sampler2D activeBufferTex;
uniform sampler2D extraBufferTex;
uniform sampler2D overlayBufferTex;
uniform sampler2D colorTex;
uniform sampler2D geoWorldPosTex;
uniform sampler2D geoNormalTex;
uniform sampler2D geoTangentTex;
uniform sampler2D normalTex;
uniform sampler2D metallicTex;
uniform sampler2D roughnessTex;
uniform sampler2D emissiveTex;
// uniform sampler2D depthTex;
uniform sampler2D aoTex;

// #ifdef USE_IBL
uniform samplerCube u_DiffuseEnvSampler;
uniform samplerCube u_SpecularEnvSampler;
uniform sampler2D u_brdfLUT;
// #endif

uniform float aoScale;

uniform vec2 u_MetallicRoughnessValues;
uniform vec4 u_BaseColorFactor;

uniform vec3 u_Camera;

#define COLOR_CHANNEL 0
#define METALLIC_CHANNEL 1
#define ROUGHNESS_CHANNEL 2
#define NORMAL_CHANNEL 3
#define EMISSIVE_CHANNEL 4
// #define ERASE_CHANNEL 1

uniform int channelType;

#define IGNORE_EXTRA 0
#define ERASE_EXTRA 1
uniform int extraChannelType;

// debugging flags used for shader output of intermediate PBR variables
uniform vec4 u_ScaleDiffBaseMR;
uniform vec4 u_ScaleFGDSpec;
uniform vec4 u_ScaleIBLAmbient;

// varying vec3 v_Position;

// varying vec2 v_UV;
varying vec2 uv;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
varying mat3 v_TBN;
#else
varying vec3 v_Normal;
#endif
#endif

// Encapsulate the various inputs used by the various functions in the shading equation
// We store values in this struct to simplify the integration of alternative implementations
// of the shading terms, outlined in the Readme.MD Appendix.
struct PBRInfo
{
    float NdotL;                  // cos angle between normal and light direction
    float NdotV;                  // cos angle between normal and view direction
    float NdotH;                  // cos angle between normal and half vector
    float LdotH;                  // cos angle between light direction and half vector
    float VdotH;                  // cos angle between view direction and half vector
    float perceptualRoughness;    // roughness value, as authored by the model creator (input to shader)
    float metalness;              // metallic value at the surface
    vec3 reflectance0;            // full reflectance color (normal incidence angle)
    vec3 reflectance90;           // reflectance color at grazing angle
    float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
    vec3 diffuseColor;            // color contribution from diffuse lighting
    vec3 specularColor;           // color contribution from specular lighting
};

const float M_PI = 3.141592653589793;
const float c_MinRoughness = 0.04;



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



vec4 SRGBtoLINEAR(vec4 srgbIn)
{
// #ifdef MANUAL_SRGB
// 	#ifdef SRGB_FAST_APPROXIMATION
// 		vec3 linOut = pow(srgbIn.xyz,vec3(2.2));
// 	#else //SRGB_FAST_APPROXIMATION
// 		vec3 bLess = step(vec3(0.04045),srgbIn.xyz);
// 		vec3 linOut = mix( srgbIn.xyz/vec3(12.92), pow((srgbIn.xyz+vec3(0.055))/vec3(1.055),vec3(2.4)), bLess );
// 	#endif //SRGB_FAST_APPROXIMATION
// 	return vec4(linOut,srgbIn.w);;
// #else //MANUAL_SRGB
	return srgbIn;
// #endif //MANUAL_SRGB
}

// Find the normal for this fragment, pulling either from a predefined normal map
// or from the interpolated mesh normal and tangent attributes.
vec3 getNormal()
{
	vec3 ng = normalize(( texture2D(geoNormalTex, uv).xyz*2.0 - 1.0 ));
	vec3 t = normalize(( texture2D(geoTangentTex, uv).xyz*2.0 - 1.0 ));
	vec4 texN = texture2D(normalTex, uv);
	texN.xyz = normalize(texN.xyz*2.0 - 1.0);

	vec3 b = normalize(cross(ng, t));


	mat3 tbn = mat3(t, b, ng);

	if (texN.x + texN.y != 0.0)
	{

		ng = normalize(ng + (texN.x*t + texN.y*b));
	}

	if (channelType==NORMAL_CHANNEL)
	{
		vec2 uvT = normalize(t.xy)*pixelStep;
		vec2 uvB = normalize(b.xy)*pixelStep;
		float me = texture2D(activeBufferTex, uv).x;
		float n = texture2D(activeBufferTex, uv - uvB).x;
		float s = texture2D(activeBufferTex, uv + uvB).x;
		float e = texture2D(activeBufferTex, uv + uvT).x;
		float w = texture2D(activeBufferTex, uv - uvT).x;

		float bumpB = ((n-me)-(s-me));
		float bumpT = ((e-me)-(w-me));

		if (bumpT + bumpB != 0.0)
		{
			vec3 normalOffset = (bumpB*t + bumpT*b);

			ng += normalOffset;
			ng = normalize(ng);

		}

	}

	return ng;
}

// Calculation of the lighting contribution from an optional Image Based Light source.
// Precomputed Environment Maps are required uniform inputs and are computed as outlined in [1].
// See our README.md on Environment Maps [3] for additional discussion.
vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
{
	float mipCount = 9.0; // resolution of 512x512
	float lod = (pbrInputs.perceptualRoughness * mipCount);
	// retrieve a scale and bias to F0. See [1], Figure 3
	vec3 brdf = SRGBtoLINEAR(texture2D(u_brdfLUT, vec2(pbrInputs.NdotV, 1.0 - pbrInputs.perceptualRoughness))).rgb;
	vec3 diffuseLight = SRGBtoLINEAR(textureCube(u_DiffuseEnvSampler, n)).rgb;

// #ifdef USE_TEX_LOD
	vec3 specularLight = SRGBtoLINEAR(textureCubeLodEXT(u_SpecularEnvSampler, reflection, lod)).rgb;
// #else
	// vec3 specularLight = SRGBtoLINEAR(textureCube(u_SpecularEnvSampler, reflection)).rgb;
// #endif

	vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
	vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);

	// // For presentation, this allows us to disable IBL terms
	// diffuse *= u_ScaleIBLAmbient.x;
	// specular *= u_ScaleIBLAmbient.y;

	return diffuse + specular;
}

// Basic Lambertian diffuse
// Implementation from Lambert's Photometria https://archive.org/details/lambertsphotome00lambgoog
// See also [1], Equation 1
vec3 diffuse(PBRInfo pbrInputs)
{
	return pbrInputs.diffuseColor / M_PI;
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// Implementation of fresnel from [4], Equation 15
vec3 specularReflection(PBRInfo pbrInputs)
{
	return pbrInputs.reflectance0 + (pbrInputs.reflectance90 - pbrInputs.reflectance0) * pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
}

// This calculates the specular geometric attenuation (aka G()),
// where rougher material will reflect less light back to the viewer.
// This implementation is based on [1] Equation 4, and we adopt their modifications to
// alphaRoughness as input as originally proposed in [2].
float geometricOcclusion(PBRInfo pbrInputs)
{
	float NdotL = pbrInputs.NdotL;
	float NdotV = pbrInputs.NdotV;
	float r = pbrInputs.alphaRoughness;

	float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
	float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
	return attenuationL * attenuationV;
}

// The following equation(s) model the distribution of microfacet normals across the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes from EPIC Games [1], Equation 3.
float microfacetDistribution(PBRInfo pbrInputs)
{
	float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
	float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
	return roughnessSq / (M_PI * f * f);
}


void main()
{
	vec4 clr = texture2D(colorTex, uv);
	
	vec4 ch = texture2D(activeBufferTex, uv);
	vec4 over = texture2D(overlayBufferTex, uv);
	

	if (over.a > 0.0) over.rgb /= over.a;
	ch.rgb = mix(ch.rgb, over.rgb, over.a);
	ch.a = over.a + ch.a*(1.0 - over.a);


	if (ch.a > 0.0) ch.rgb /= ch.a;
	

	vec4 erase = texture2D(extraBufferTex, uv);//.r;
	gl_FragColor = clr;
	gl_FragColor.a = 1.0;

	
	if (extraChannelType == ERASE_EXTRA)
	{
		ch.a = (1.0 - erase.a) * ch.a;
	}

	if (clr.a > 0.0)
	{
		ch = clamp(ch, vec4(0.0), vec4(1.0));
		float a = clamp(ch.a, 0.0, 1.0);

		// Metallic and Roughness material properties are packed together
		// In glTF, these factors can be specified by fixed scalar values
		// or from a metallic-roughness map
		float perceptualRoughness = u_MetallicRoughnessValues.y;
		float metallic = u_MetallicRoughnessValues.x;
	// #ifdef HAS_METALROUGHNESSMAP
		// Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
		// This layout intentionally reserves the 'r' channel for (optional) occlusion map data
		// vec4 mrSample = texture2D(metallicRoughnessTex, uv);//vec4(1.0);//
		vec4 mrSample = texture2D(roughnessTex, uv);//vec4(1.0);//

		// perceptualRoughness = mrSample.g * perceptualRoughness;
		perceptualRoughness = mrSample.r * perceptualRoughness;
		if (channelType==ROUGHNESS_CHANNEL)
		{
			perceptualRoughness = clamp((ch.r+ch.g+ch.b)/3.0, 0.0, 1.0)*a + perceptualRoughness*(1.0-a);
		}
		// else

		mrSample = texture2D(metallicTex, uv);
		metallic = mrSample.r * metallic;
		if (channelType==METALLIC_CHANNEL)
		{
			metallic = clamp((ch.r+ch.g+ch.b)/3.0, 0.0, 1.0)*a + metallic*(1.0-a);
		}
		// else
	// #endif
		perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
		metallic = clamp(metallic, 0.0, 1.0);
		// Roughness is authored as perceptual roughness; as is convention,
		// convert to material roughness by squaring the perceptual roughness [2].
		float alphaRoughness = perceptualRoughness * perceptualRoughness;

		// The albedo may be defined from a base texture or a flat color
	// #ifdef HAS_BASECOLORMAP
		// vec4 baseColor = SRGBtoLINEAR(texture2D(u_BaseColorSampler, v_UV)) * u_BaseColorFactor;
		vec4 baseColor = SRGBtoLINEAR(texture2D(colorTex, uv)) * u_BaseColorFactor;
		if (channelType==COLOR_CHANNEL)
		{
			baseColor.rgb = mix(baseColor.rgb, ch.rgb, a);
			baseColor.a = a + baseColor.a*(1.0-a);
		}
	// #else
	//	vec4 baseColor = u_BaseColorFactor;
	// #endif

		vec3 f0 = vec3(0.04);
		vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0);
		diffuseColor *= 1.0 - metallic;
		vec3 specularColor = mix(f0, baseColor.rgb, metallic);

		// Compute reflectance.
		float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

		// For typical incident reflectance range (between 4% to 100%) set the grazing reflectance to 100% for typical fresnel effect.
		// For very low reflectance range on highly diffuse objects (below 4%), incrementally reduce grazing reflecance to 0%.
		float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
		vec3 specularEnvironmentR0 = specularColor.rgb;
		vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;

		vec3 v_Position = texture2D(geoWorldPosTex, uv).rgb;

		vec3 n = getNormal();                             // normal at surface point
		vec3 v = normalize(u_Camera - v_Position);        // Vector from surface point to camera
		vec3 l = normalize(u_LightDirection);             // Vector from surface point to light
		vec3 h = normalize(l+v);                          // Half vector between both l and v
		vec3 reflection = -normalize(reflect(v, n));

		float NdotL = clamp(dot(n, l), 0.001, 1.0);
		float NdotV = abs(dot(n, v)) + 0.001;
		float NdotH = clamp(dot(n, h), 0.0, 1.0);
		float LdotH = clamp(dot(l, h), 0.0, 1.0);
		float VdotH = clamp(dot(v, h), 0.0, 1.0);

		PBRInfo pbrInputs = PBRInfo(
			NdotL,
			NdotV,
			NdotH,
			LdotH,
			VdotH,
			perceptualRoughness,
			metallic,
			specularEnvironmentR0,
			specularEnvironmentR90,
			alphaRoughness,
			diffuseColor,
			specularColor
		);

		// Calculate the shading terms for the microfacet specular shading model
		vec3 F = specularReflection(pbrInputs);
		float G = geometricOcclusion(pbrInputs);
		float D = microfacetDistribution(pbrInputs);

		// Calculation of analytical lighting contribution
		vec3 diffuseContrib = (1.0 - F) * diffuse(pbrInputs);
		vec3 specContrib = F * G * D / (4.0 * NdotL * NdotV);
		// Obtain final intensity as reflectance (BRDF) scaled by the energy of the light (cosine law)
		vec3 color = NdotL * u_LightColor * (diffuseContrib + specContrib);
		

		// Calculate lighting contribution from image based lighting source (IBL)
	// #ifdef USE_IBL
		color += getIBLContribution(pbrInputs, n, reflection)*u_ScaleIBLAmbient.z;
	// #endif


		// Apply optional PBR terms for additional (optional) shading
	// #ifdef HAS_OCCLUSIONMAP
		// float ao = texture2D(u_OcclusionSampler, v_UV).r;
		float ao = 1.0 - texture2D(aoTex, uv).r;
		color = mix(color, color * ao, aoScale);
	// #endif

	// #ifdef HAS_EMISSIVEMAP
		vec3 emissive = SRGBtoLINEAR(texture2D(emissiveTex, uv)).rgb;// * u_EmissiveFactor;
		if (channelType==EMISSIVE_CHANNEL)
		{
			emissive = ch.rgb*a + emissive*(1.0-a);
		}
		color += emissive;
	// #endif

		// This section uses mix to override final color for reference app visualization
		// of various parameters in the lighting equation.
		color = color*(1.0-u_ScaleDiffBaseMR.y) + baseColor.rgb*u_ScaleDiffBaseMR.y;

		gl_FragColor = vec4(pow(color,vec3(1.0/2.2)), baseColor.a);

	}
	
}
