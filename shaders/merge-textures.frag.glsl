precision highp float;

uniform sampler2D layer0;
uniform sampler2D layer1;
uniform sampler2D layer2;
uniform sampler2D layer3;
uniform sampler2D layer4;
uniform sampler2D layer5;
uniform mat3 opacity;
uniform int layerCount;
varying vec2 uv;

vec4 combine(vec4 baseClr, vec4 clr, float a)
{
	// return mix(baseClr, clr, a);
	if (clr.a > 0.0)	clr.rgb /= clr.a;

	float opacity = clamp((a + baseClr.a*(1.0-a)), 0.0, 1.0);

	return vec4(mix(baseClr.rgb, clr.rgb, a), opacity);
}

void main() {
	vec4 baseClr;
	vec4 clr = texture2D(layer0, uv);
	float a;
	int i = 1;

	// for (int i = 1; i < 6; i++)
	if (i < layerCount)
	{
		baseClr = vec4(clr.rgb, clr.a*opacity[0].x);

		clr = texture2D(layer1, uv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[0].y;
		clr = combine(baseClr, clr, a);
		
		i += 1;
	}
	if (i < layerCount)
	{
		baseClr = clr;

		clr = texture2D(layer2, uv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[0].z;
		clr = combine(baseClr, clr, a);
		
		i += 1;
	}
	if (i < layerCount)
	{
		baseClr = clr;

		clr = texture2D(layer3, uv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[1].x;
		clr = combine(baseClr, clr, a);
		i += 1;
	}
	if (i < layerCount)
	{
		baseClr = clr;

		clr = texture2D(layer4, uv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[1].y;
		clr = combine(baseClr, clr, a);
		i += 1;
	}
	if (i < layerCount)
	{
		baseClr = clr;

		clr = texture2D(layer5, uv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[1].z;
		clr = combine(baseClr, clr, a);
		i += 1;
	}

	gl_FragColor = clr;
}