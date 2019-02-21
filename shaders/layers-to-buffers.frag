#extension GL_EXT_draw_buffers : require
#extension GL_EXT_frag_depth : enable

precision highp float;

uniform mat4 model, view, projection;

varying vec2 vUv;
varying float camDepth;
varying float camW;

varying vec3 vP;
varying vec4 vP4;
varying vec3 vPmodel;
varying vec3 vN;
varying vec3 vEye;

uniform sampler2D layer0;
uniform sampler2D layer1;
uniform sampler2D layer2;
uniform sampler2D layer3;
uniform sampler2D layer4;
uniform sampler2D layer5;
uniform mat3 opacity;
uniform int layerCount;
uniform int dataType;

uniform float Fcoef;
uniform vec2 uNearFar;


void main() {

	vec4 clr;
	float a;
	int i = 0;

	// for (int i = 1; i < 6; i++)
	if (i < layerCount)
	{
		clr = texture2D(layer0, vUv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[0].x;
		gl_FragData[0] = vec4(clr.rgb, a);
		// gl_FragData[0] = vec4(vec3(0.0, 1.0, 0.0), a);
		i++;
	}
	if (i < layerCount)
	{
		clr = texture2D(layer1, vUv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[0].y;
		gl_FragData[1] = vec4(clr.rgb, a);
		// gl_FragData[1] = vec4(vec3(0.0, 0.0, 1.0), a);
		i++;
	}
	if (i < layerCount)
	{
		clr = texture2D(layer2, vUv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[0].z;
		gl_FragData[2] = vec4(clr.rgb, a);
		i++;
	}
	if (i < layerCount)
	{
		clr = texture2D(layer3, vUv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[1].x;
		gl_FragData[3] = vec4(clr.rgb, a);
		i++;
	}
	if (i < layerCount)
	{
		clr = texture2D(layer4, vUv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[1].y;
		gl_FragData[4] = vec4(clr.rgb, a);
		i++;
	}
	if (i < layerCount)
	{
		clr = texture2D(layer5, vUv);
		a = clamp(clr.a, 0.0, 1.0)*opacity[1].z;
		gl_FragData[5] = vec4(clr.rgb, a);
		i++;
	}

	// gl_FragDepth = log2(camW) * Fcoef*0.5;
	gl_FragDepthEXT = log2(camW) * Fcoef*0.5;

}