'use strict'

function creatFillMeshTexture(self)
{
	return self.regl({
		vert: `
			precision highp float;

			attribute vec3 position;
			attribute vec3 normal;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = vec4(uv*2.0 - 1.0, 0.0, 1.0);
			}`,

		frag: `
			precision highp float;
			
			uniform vec4 fillColor;

			void main() {
				gl_FragColor = fillColor;
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
			fillColor: self.regl.prop('fillColor'),
		}
	})
}

export {creatFillMeshTexture};