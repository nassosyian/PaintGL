precision highp float;

varying vec2 vUv;
varying vec4 vPos;
varying vec3 vN;
varying vec3 vEye;

uniform vec2 iRes;
uniform vec2 uNearFar;
uniform float Fcoef;
uniform vec2 step;
uniform sampler2D bgTex;
uniform sampler2D paint;
uniform sampler2D depth;
uniform sampler2D nearDepth;
uniform bool erase;
// uniform sampler2D uvTex;

void main() {
	bool differentDepth = false;
	float maxZGap = 0.02;


	vec4 txClr = vec4(vUv, 0.0, 1.0);
	
	vec3 N = normalize( vN );
	vec3 eye = normalize( vEye );
	{
		vec2 screenUV = vPos.xy*0.5 + vec2(0.5);
		float z = texture2D(depth, screenUV).r;
		float nearZ = texture2D(nearDepth, screenUV).r;

		float posZ = log2(vPos.w) * Fcoef*0.5;
		// float posZ = log2(vPos.w) * Fcoef*0.2;

		vec4 clr = texture2D(paint, screenUV);
		if (clr.a > 0.0)	clr.rgb /= clr.a;
		float tolerance = 0.05;//0.01;
		float d = dot(N, -eye);

		float gap = 0.0;
		float nearGap = abs(posZ - nearZ);

		vec4 bgClr = texture2D(bgTex, vUv);
		if (differentDepth==false && posZ < z && nearGap < 0.001 && d > 0.1)
		{
			float fade = max(0.0, 0.13 - d);
			if (fade > 0.0)
			{
				fade /= 0.03;
				fade = 1.0 - fade;
				fade = smoothstep(0.0, 1.0, fade);
				fade = 1.0 - fade;
			}
			float a = clamp(clr.a, 0.0, 1.0);

			if (erase)
			{
				a = clamp(bgClr.a * (1.0 - a), 0.0, 1.0);
				vec3 rgb = bgClr.rgb;
				if (bgClr.a > 0.0)
				{
					rgb /= bgClr.a;
					rgb *= a;
					bgClr.rgb = rgb;
				}
				gl_FragColor = vec4(bgClr.rgb, a );
			}
			else
			{

				vec4 final = vec4( mix(bgClr.rgb, clr.rgb, a), clamp(a + bgClr.a*(1.0-a), 0.0, 1.0) );
				final = mix(final, texture2D(bgTex, vUv), fade);
				
				gl_FragColor = final;
			}

		}
		else
		{
			// when extracting the normal map,
			// it seems that the bgTex is always *BLACK*
			gl_FragColor = texture2D(bgTex, vUv);
		}

	}
}