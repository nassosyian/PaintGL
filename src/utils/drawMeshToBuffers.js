'use strict'
const mat4 = require('gl-mat4');
import packingFuncsGLSL from '../../shaders/packing.glsl'

const mat4Inverse = `
				mat4 inverse(mat4 m) {
					float
						a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],
						a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],
						a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],
						a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],
					
						b00 = a00 * a11 - a01 * a10,
						b01 = a00 * a12 - a02 * a10,
						b02 = a00 * a13 - a03 * a10,
						b03 = a01 * a12 - a02 * a11,
						b04 = a01 * a13 - a03 * a11,
						b05 = a02 * a13 - a03 * a12,
						b06 = a20 * a31 - a21 * a30,
						b07 = a20 * a32 - a22 * a30,
						b08 = a20 * a33 - a23 * a30,
						b09 = a21 * a32 - a22 * a31,
						b10 = a21 * a33 - a23 * a31,
						b11 = a22 * a33 - a23 * a32,
					
						det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
					
					return mat4(
						a11 * b11 - a12 * b10 + a13 * b09,
						a02 * b10 - a01 * b11 - a03 * b09,
						a31 * b05 - a32 * b04 + a33 * b03,
						a22 * b04 - a21 * b05 - a23 * b03,
						a12 * b08 - a10 * b11 - a13 * b07,
						a00 * b11 - a02 * b08 + a03 * b07,
						a32 * b02 - a30 * b05 - a33 * b01,
						a20 * b05 - a22 * b02 + a23 * b01,
						a10 * b10 - a11 * b08 + a13 * b06,
						a01 * b08 - a00 * b10 - a03 * b06,
						a30 * b04 - a31 * b02 + a33 * b00,
						a21 * b02 - a20 * b04 - a23 * b00,
						a11 * b07 - a10 * b09 - a12 * b06,
						a00 * b09 - a01 * b07 + a02 * b06,
						a31 * b01 - a30 * b03 - a32 * b00,
						a20 * b03 - a21 * b01 + a22 * b00) / det;
				}`;


function createDrawMeshToBuffers(self)
{
	return self.regl({
		vert: `
			precision highp float;
			attribute vec3 position;
			// attribute vec3 normal;
			attribute vec2 uv;
			// attribute float occlusion;
			
			uniform mat4 model, view, projection;
			uniform mat4 uNormalMatrix;
			uniform float Fcoef;
			varying vec2 vUv;
			varying float camDepth;
			varying float camW;

			varying vec3 vP;
			varying vec4 vP4;
			varying vec3 vPmodel;
			// varying vec3 vN;
			varying vec3 vEye;

			void main() {
				vUv = uv;
				vPmodel = (model * vec4(position, 1.0)).xyz;
				vec4 p = (view * model * vec4(position, 1.0));
				vEye = p.xyz;
				p = (projection * p);

				// gl_Position = projection * view * model * vec4(position, 1.0);
				gl_Position = p;
				vP4 = p;//vec4(p.xyz/p.w, p.w);
				vP4 = (projection * view * model * vec4(position, 1.0));
				vP = p.xyz / p.w;
				gl_Position.z = log2(max(1e-6, 1.0 + gl_Position.w)) * Fcoef - 1.0;

				camDepth = gl_Position.z;
				// camW = gl_Position.w;
				camW = 1.0 + gl_Position.w;
				// gl_Position = vec4(uv*2.0 - 1.0, 0.0, 1.0);
			}`,

		frag: `
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
			}`,

		depth: {
			enable: true
		},
		stencil: {
			enable: false,
		},
		cull: {
			enable: true,
			face: 'back'
		},

		// this converts the vertices of the mesh into the position attribute
		attributes: {
			position: self.regl.prop('verticesBuffer'),
			// normal: self.regl.prop('normalsBuffer'),
			uv: self.regl.prop('uvsBuffer'),
			// occlusion: self.regl.prop('aoBuffer')
		},

		// and this converts the faces of the mesh into elements
		elements: self.regl.prop('indeces'),

		uniforms: {
			// tex: self.regl.this('meshTexture'),
			colorTex: self.regl.prop('colorTex'),
			// normalTex: self.regl.prop('normalTex'),
			metallicTex: self.regl.prop('metallicTex'),
			roughnessTex: self.regl.prop('roughnessTex'),
			emissiveTex: self.regl.prop('emissiveTex'),
			uNearFar: () => [self.zNear, self.zFar],
			Fcoef: () => (2.0 / Math.log2(self.zFar + 1.0)),
			// uNormalMatrix: () => {
			// 	// const now = (new Date).getTime();
			// 	// self.camera.idle( now - 1);
			// 	// self.camera.recalcMatrix( now );
			// 	// self.camera.flush( now );
			// 	self.flushCamera()

			// 	var nm = mat4.invert(mat4.identity([]), self.camera.computedMatrix);
			// 	nm = mat4.transpose(mat4.identity([]), nm);
			// 	return nm;
			// },
			occlusionOpacity: self.regl.this('aoOpacity'),
			model: mat4.identity([]),
			view: ({tick}) => {
					// const now = (new Date).getTime();
					// self.camera.idle( now - 1);
					// self.camera.recalcMatrix( now );
					// self.camera.flush( now );
					// return self.flushCamera();
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
								// (viewportWidth / viewportHeight),
								self.canvasScreenAspect,
								self.zNear, self.zFar)
							,
		}
	})
};

export {createDrawMeshToBuffers};