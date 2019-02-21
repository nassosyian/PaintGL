'use strict'
const mat4 = require('gl-mat4');

function createDrawMeshUV(self)
{
	return self.regl({
		vert: `
			precision highp float;
			attribute vec3 position;
			attribute vec2 uv;

			uniform mat4 model, view, projection;
			uniform float Fcoef;
			varying vec2 vUv;
			varying float camDepth;
			varying float camW;
			void main() {
				vUv = uv;
				gl_Position = projection * view * model * vec4(position, 1);
				gl_Position.z = log2(max(1e-6, 1.0 + gl_Position.w)) * Fcoef - 1.0;

				camDepth = gl_Position.z;
				// camW = gl_Position.w;
				camW = 1.0 + gl_Position.w;
				// gl_Position = vec4(uv*2.0 - 1.0, 0.0, 1.0);
			}`,

		frag: `
			#extension GL_EXT_frag_depth : enable
			// #extension GL_OES_standard_derivatives : enable
			precision highp float;

			varying vec2 vUv;
			varying float camDepth;
			varying float camW;
			uniform float Fcoef;
			uniform vec2 uNearFar;
			void main() {
				gl_FragDepthEXT = log2(camW) * Fcoef*0.5;

				gl_FragColor = vec4(vUv, 1.0, 1.0);
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
			face: self.regl.this('cullFace')
		},

		// this converts the vertices of the mesh into the position attribute
		attributes: {
			position: self.regl.prop('verticesBuffer'),
			uv: self.regl.prop('uvsBuffer')
		},

		// and this converts the faces of the mesh into elements
		elements: self.regl.prop('indeces'),

		uniforms: {
			// tex: self.regl.this('meshTexture'),
			uNearFar: () => [self.zNear, self.zFar],
			Fcoef: () => (2.0 / Math.log2(self.zFar + 1.0)),
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

export {createDrawMeshUV};
