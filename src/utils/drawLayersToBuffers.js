'use strict'
const mat4 = require('gl-mat4');
import packingFuncsGLSL from '../../shaders/packing.glsl'


function createDrawLayersToBuffers(self)
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
			varying float camDepth;
			varying float camW;

			varying vec3 vP;
			varying vec4 vP4;
			varying vec3 vPmodel;
			varying vec3 vN;
			varying vec3 vEye;

			void main() {
				vUv = uv;
				vN = (uNormalMatrix * vec4(normal, 1.0)).xyz;
				vPmodel = (model * vec4(position, 1.0)).xyz;
				vec4 p = (view * model * vec4(position, 1.0));
				vEye = p.xyz;
				p = (projection * p);

				gl_Position = p;
				vP4 = p;//vec4(p.xyz/p.w, p.w);
				vP4 = (projection * view * model * vec4(position, 1.0));
				vP = p.xyz / p.w;
				gl_Position.z = log2(max(1e-6, 1.0 + gl_Position.w)) * Fcoef - 1.0;

				camDepth = gl_Position.z;
				camW = 1.0 + gl_Position.w;
			}`,

		frag: `
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
			normal: self.regl.prop('normalsBuffer'),
			uv: self.regl.prop('uvsBuffer'),
			// occlusion: self.regl.prop('aoBuffer')
		},

		// and this converts the faces of the mesh into elements
		elements: self.regl.prop('indeces'),

		uniforms: {
			layer0: self.regl.prop('layer0'),
			layer1: self.regl.prop('layer1'),
			layer2: self.regl.prop('layer2'),
			layer3: self.regl.prop('layer3'),
			layer4: self.regl.prop('layer4'),
			layer5: self.regl.prop('layer5'),
			opacity: self.regl.prop('opacity'),
			layerCount: self.regl.prop('layerCount'),
			dataType: 0,//self.regl.prop('dataType'),


			uNearFar: () => [self.zNear, self.zFar],
			Fcoef: () => (2.0 / Math.log2(self.zFar + 1.0)),
			uNormalMatrix: () => {
				// const now = (new Date).getTime();
				// self.camera.idle( now - 1);
				// self.camera.recalcMatrix( now );
				// self.camera.flush( now );
				self.flushCamera()

				var nm = mat4.invert(mat4.identity([]), self.camera.computedMatrix);
				nm = mat4.transpose(mat4.identity([]), nm);
				return nm;
			},
			// occlusionOpacity: self.regl.this('aoOpacity'),
			model: mat4.identity([]),
			view: ({tick}) => {
					// const now = (new Date).getTime();
					// self.camera.idle( now - 1);
					// self.camera.recalcMatrix( now );
					// self.camera.flush( now );
					return self.flushCamera();
					// return self.camera.computedMatrix
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

export {createDrawLayersToBuffers};