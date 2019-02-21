'use strict'

import ToolBrush from './ToolBrush.js'
const glsl = require('glslify')
const mat4 = require('gl-mat4')
import brushVert from '../../shaders/brush-stroke.vert.glsl'
import brushFrag from '../../shaders/brush-stroke.frag.glsl'
import {lerp} from '../utils/lerp.js'
import {length} from 'gl-vec2'


class ToolEraser extends ToolBrush 
{
	vertShader() { return brushVert; }
	fragShader() { return brushFrag; }
	getBlend() 
	{
		return {
			enable: true,
			// equation: 'subtract',
			// equation: 'reverse subtract',
			// func: {src:'src alpha',dst:'one minus src alpha'},
			// func: {src:'dst alpha',dst:'one minus dst alpha'},
			// func: {src:'src alpha',dst:'one minus dst alpha'},
			// func: {src: 'one',	dst: 'one'}
			// func: {src: 'one',	dst: 'one minus src alpha'}

			func: {srcRGB: 'src alpha', srcAlpha: 'one', dstRGB: 'one minus src alpha', dstAlpha: 'one minus src alpha'}

			// func: {srcRGB: 'one', srcAlpha: 'one', dstRGB: 'one minus src alpha', dstAlpha: 'one minus src alpha'}
			// func: {srcRGB: 'zero', srcAlpha: 'one', dstRGB: 'one', dstAlpha: 'one'}
			// func: {srcRGB: 'dst color', srcAlpha: 'one', dstRGB: 'one', dstAlpha: 'one'}
		}
	}

	constructor(state, options)
	{
		super(state, options);
	}

	activate(state)
	{
		super.activate(state);
		state.pointerStyle = null;
		this.fbo = state.regl.framebuffer({
										width: state.viewerExtraTex.width,
										height: state.viewerExtraTex.height,
										color: state.viewerExtraTex, 
										depthStencil: false
									});
		log(state.viewerExtraTex.width+' ', state.viewerExtraTex.height+' ', state.viewerExtraTex.format);
		this.fbo.use(() => {
				state.regl.clear({
								// depth: 0,
								// color: [1, 1, 1, 1]
								color: [0, 0, 0, 0]
							})
			});
		state.refreshMesh = true;
		// state.pointerStyle = `url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiINCgkgdmlld0JveD0iMCAwIDMyIDMyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzMiAzMjsiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPGc+DQoJPHBvbHlnb24gaWQ9ImZpbGwiIGZpbGw9IiNGRkZGRkYiIHBvaW50cz0iNC42LDI5IDkuNywyNi41IDIxLjYsMTQuNyAxNi44LDEwLjkgNS4yLDIyLjUgMi44LDI3LjEgMC40LDI5LjkgMS44LDMxLjYgCSIvPg0KCTxwYXRoIGQ9Ik0yNS4zLDExLjVsLTQuOS00LjlsLTIuMy0yLjNjLTAuMy0wLjMtMC42LTAuMy0wLjksMGwtMy42LDMuNmMtMC4zLDAuMy0wLjMsMC42LDAsMC45TDE2LDExTDUsMjJjLTAuMSwwLTAuMSwwLTAuMSwwLjENCgkJbC0zLjIsNS40Yy0wLjEsMC4xLTAuMywwLjMtMC40LDAuNEMwLjYsMjguNiwwLDI5LjIsMCwzMGMwLDAuNCwwLjMsMC45LDAuNywxLjRzMC45LDAuNywxLjQsMC42YzAuOCwwLDEuNC0wLjYsMi4xLTEuMw0KCQljMC4xLTAuMSwwLjMtMC4zLDAuNC0wLjRsNS40LTMuMWMwLjEtMC4xLDAuMS0wLjEsMC4xLTAuMWwxMC45LTExbDIuMywyLjNjMC4zLDAuMywwLjYsMC4zLDAuOSwwbDMuNi0zLjZjMC4zLTAuMywwLjMtMC42LDAtMC45DQoJCUwyNS4zLDExLjV6IE0zLjEsMjkuOGMtMC40LDAuNC0wLjksMC45LTEuMiwwLjljLTAuMiwwLTAuNC0wLjItMC41LTAuM2MtMC4yLTAuMi0wLjMtMC40LTAuMy0wLjVjMC0wLjMsMC40LTAuOCwwLjktMS4xDQoJCWMwLjItMC4xLDAuNC0wLjMsMC41LTAuNWMwLDAsMC0wLjEsMC4xLTAuMWwxLDFjMCwwLTAuMSwwLTAuMSwwLjFDMy40LDI5LjUsMy4zLDI5LjYsMy4xLDI5Ljh6IE05LjIsMjYuMWwtNC4zLDIuNWwtMS41LTEuNQ0KCQlMNiwyMi44bDEwLjktMTAuOWwzLjMsMy4zTDkuMiwyNi4xeiIvPg0KCTxwYXRoIGQ9Ik0zMSwxLjhsLTAuOC0wLjdjLTAuNi0wLjYtMS4zLTAuOS0yLjEtMC45Yy0wLjgsMC0xLjYsMC4zLTIuMSwwLjlsLTQuNyw0LjdsNC45LDQuOUwzMSw2YzAuNi0wLjYsMC45LTEuMywwLjktMi4xDQoJCUMzMS44LDMuMSwzMS41LDIuMywzMSwxLjh6Ii8+DQo8L2c+DQo8L3N2Zz4NCg==") 0 64, auto`
		// ;
	}

	deactivate(state)
	{
		this.fbo.use(() => {
			state.paintSurfTextures[0]({
				copy: true,
				width: state.paintSurfTextures[0].width,
				height: state.paintSurfTextures[0].height,
				format: state.paintSurfTextures[0].format,
				type: state.paintSurfTextures[0].type,
			})
		});
		
		// state.tools.orbit.bakePaint(state, true);
		super.deactivate(state, true);
		// super.deactivate(state);
		state.pointerStyle = null;
		this.fbo.destroy();
		this.fbo = null;
	}
}


export default ToolEraser

