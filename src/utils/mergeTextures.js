'use strict'

import compositeStrokeVert from '../../shaders/composite-strokes.vert.glsl'
import mergeLayersFrag from '../../shaders/merge-textures.frag.glsl'

function creatMergeTextures(self)
{
	return self.regl({
		vert: compositeStrokeVert,

		frag: mergeLayersFrag,

		depth: {
			enable: false
		},
		stencil: {
			enable: false,
		},


		// this converts the vertices of the mesh into the position attribute
		attributes: {
			position: [ -4, -4, 4, -4, 0, 4 ]
		},
		count: 3,
		// attributes: {
			
		// 	position: self.regl.prop('verticesBuffer'),
		// 	// normal: self.regl.prop('normalsBuffer'),
		// 	uv: self.regl.prop('uvsBuffer')
		// },

		// and this converts the faces of the mesh into elements
		// elements: self.regl.prop('indeces'),

		uniforms: {
			// fillColor: self.regl.prop('fillColor'),
			// layer: self.regl.prop('layers'),
			layer0: self.regl.prop('layer0'),
			layer1: self.regl.prop('layer1'),
			layer2: self.regl.prop('layer2'),
			layer3: self.regl.prop('layer3'),
			layer4: self.regl.prop('layer4'),
			layer5: self.regl.prop('layer5'),
			opacity: self.regl.prop('opacity'),
			layerCount: self.regl.prop('layerCount'),
		}
	})
}

export {creatMergeTextures};