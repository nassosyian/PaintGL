'use strict'
const mat4 = require('gl-mat4');

function createDrawMeshWorldPos(self)
{
	return self.regl({
		vert: `
			precision highp float;
			attribute vec3 position;
			attribute vec3 normal;
			attribute vec2 uv;

			uniform mat4 model, view, projection;
			uniform mat4 uNormalMatrix;			
			uniform float Fcoef;
			varying vec2 vUv;
			varying vec3 vP;
			varying vec3 vN;
			varying float camDepth;
			varying float camW;

			void main() {
				vUv = uv;
				vN = (uNormalMatrix * vec4(normal, 1.0)).xyz;
				vP = (model * vec4(position, 1)).xyz;
				gl_Position = projection * view * model * vec4(position, 1);
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
			}`,
		
		depth: {
			enable: true,
			// func: self.regl.prop('depthFunc')
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
			normal: self.regl.prop('normalsBuffer'),			
			uv: self.regl.prop('uvsBuffer')
		},

		// and this converts the faces of the mesh into elements
		elements: self.regl.prop('indeces'),

		uniforms: {
			normalTex: self.regl.prop('normalTex'),			
			uNearFar: () => [self.zNear, self.zFar],
			Fcoef: () => (2.0 / Math.log2(self.zFar + 1.0)),
			uNormalMatrix: () => {
				// const now = (new Date).getTime();
				// self.camera.idle( now - 1);
				// self.camera.recalcMatrix( now );
				// self.camera.flush( now );
				// self.flushCamera()

				var nm = mat4.invert(mat4.identity([]), self.camera.computedMatrix);
				nm = mat4.transpose(mat4.identity([]), nm);
				return nm;
			},
			model: mat4.identity([]),
			view: ({tick}) => {
					return self.camera.computedMatrix
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
		}
	})
}

export {createDrawMeshWorldPos};