'use strict'
const mat4 = require('gl-mat4');

function creatExtractMeshTexture(self)
{
	return self.regl({
		vert: `
			precision highp float;

			attribute vec3 position;
			attribute vec3 normal;
			attribute vec2 uv;

			uniform mat4 model, view, projection, uNormalMatrix;
			uniform float Fcoef;

			varying vec2 vUv;
			varying vec4 vPos;
			varying vec3 vN;
			varying vec3 vEye;
			// varying vec3 vNormal;

			void main() {
				vUv = uv;

				vN = (uNormalMatrix * vec4(normal, 1)).xyz;

				// vec4 p = (projection * view * model * vec4(position, 1));
				vec4 p = (view * model * vec4(position, 1));
				vEye = p.xyz;
				p = (projection * p);
				p.z = log2(max(1e-6, 1.0 + p.w)) * Fcoef - 1.0;
				// vPos = vec4(p.xy / p.w, p.z, p.w);
				vPos = vec4(p.xyz / p.w, p.w);
				vPos.w = 1.0 + vPos.w;
				gl_Position = vec4(uv*2.0 - 1.0, 0.0, 1.0);
			}`,

		frag: `
			// #extension GL_OES_standard_derivatives : enable
			// #extension GL_EXT_shader_texture_lod : enable
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
			}`,

		depth: {
			enable: false
		},
		stencil: {
			enable: false,
		},


		// this converts the vertices of the mesh into the position attribute
		attributes: {
			position: self.regl.prop('verticesBuffer'),
			normal: self.regl.prop('normalsBuffer'),
			uv: self.regl.prop('uvsBuffer')
		},

		// and this converts the faces of the mesh into elements
		elements: self.regl.prop('indeces'),

		uniforms: {
			// tex: self.regl.this('meshTexture'),
			bgTex: self.regl.prop('bgTex'),

			erase: self.regl.prop('erase'),
			paint: () => self.paintSurfTextures[0],//self.paintState],
			depth: self.regl.this('meshDepthTexMidpoint'),
			nearDepth: self.regl.this('meshDepthTexLess'),
			// uvTex: self.regl.this('meshUVTex'),
			step: ({framebufferWidth, framebufferHeight}) => [1.0/framebufferWidth, 1.0/framebufferHeight],
			Fcoef: () => (2.0 / Math.log2(self.zFar + 1.0)),
			uNearFar: () => [self.zNear, self.zFar],
			uNormalMatrix: () => {
				const now = (new Date).getTime();
				self.camera.idle( now - 1);
				self.camera.recalcMatrix( now );
				self.camera.flush( now );

				var nm = mat4.invert(mat4.identity([]), self.camera.computedMatrix);
				nm = mat4.transpose(mat4.identity([]), nm);
				return nm;
			},
			model: mat4.identity([]),
			iRes: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
			// uAspect: ({viewportWidth, viewportHeight}) => viewportWidth / viewportHeight,
			view: ({tick}) => {
					const now = (new Date).getTime();
					self.camera.idle( now - 1);
					self.camera.recalcMatrix( now );
					self.camera.flush( now );
					return self.camera.computedMatrix
					// const t = 0.01 * tick
					// return mat4.lookAt([],
					// 	[30 * Math.cos(t), 2.5, 30 * Math.sin(t)],
					// 	[0, 2.5, 0],
					// 	[0, 1, 0])
			},
			projection: ({viewportWidth, viewportHeight}) =>
							mat4
							.perspective([],
							// .perspectiveFromFieldOfView([],
								// Math.PI / 4,
								self.viewerFov,
								// viewportWidth / viewportHeight,
								self.canvasScreenAspect,
								self.zNear, self.zFar)
			}
		})
}

export {creatExtractMeshTexture};