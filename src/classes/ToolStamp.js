'use strict'

import Tool from './Tool.js'
// const glsl = require('glslify')
const mat4 = require('gl-mat4')
// import SurfAction from '../utils/createPaintSurfAction.js'
import {createActionFromCurrentPaintSurface} from '../utils/createPaintSurfAction.js'
import glslVert from '../../shaders/stamp-stroke.vert.glsl'
import glslFrag from '../../shaders/stamp-stroke.frag.glsl'
import {lerp} from '../utils/lerp.js'
import {length} from 'gl-vec2'

const TO_RADIANS = Math.PI / 180.0;

function rotate(pt, cos, sin)
{
	return [pt[0]*cos - pt[1]*sin, pt[0]*sin + pt[1]*cos];
}

function rotateX(pt, cos, sin) { return pt[0]*cos - pt[1]*sin; }
function rotateY(pt, cos, sin) { return pt[0]*sin + pt[1]*cos; }

class ToolStamp extends Tool 
{
	vertShader() { return glslVert; }
	fragShader() { return glslFrag; }
	getBlend() {
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
			// func: {srcRGB: 'one', srcAlpha: 'one', dstRGB: 'one minus src alpha', dstAlpha: 'one'}
		}
	}

	constructor(state, options)
	{
		super(state, options);

		this.draw = state.regl({
			vert: this.vertShader(),
			frag: this.fragShader(),

			// viewport: () => { return { x: 0, y: 0, 
			// 						width: state.$refs.canvas.width,
			// 						height: state.$refs.canvas.height }; },
			
			blend: this.getBlend(),

			depth: {
				enable: false
			},
			stencil: {
				enable: false,
			},

			// and this converts the faces of the mesh into elements
			// elements: bunny.cells,
			elements: state.regl.elements( {
				data: [ [0, 1, 2], [0, 2, 3] ],
				count: 6,
			}),

			// this converts the vertices of the mesh into the position attribute
			attributes: {
				position: ([[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]),
				// position: ([[10, 20], [20, 20], [20, 10], [10, 10]]),
				uvs: ([[0, 0], [1, 0], [1, 1],  [0, 1]]),
			},
			
			// count: 60,
			
			uniforms: {
				translation: state.regl.this('translation'),
				color: state.regl.this('color'),
				rot: state.regl.this('rot'),
				scale: state.regl.this('scale'),
				aspect: state.regl.this('aspect'),
				// bg: state.regl.this('bgTexture'),
				// uStampOpacity: () => state.brushStampOpacity,
				uResolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
				tex: state.regl.this('brushTexture'),
				projection: ({viewportWidth, viewportHeight}) =>
								mat4.ortho([],
									0, viewportWidth,
									0, viewportHeight,
									-10.0, 10.0)
			},

			// instances: state.regl.this('stampCount')
		})

		this.startPos = {x: 0, y: 0};
		this.frameUpdate = null;
		this.scale = [];
		this.scaleMult = 1;
		this.translation = [];
		this.rot = 0;
		this.color = [];
		this.hsva = [];
		this.brushTexture = null;
		this.fbo = null;

		this.uvMapScale = [1, 1];
		this.getUVMapWidthScale = ()=>{ return state._uvMapScale[0] ? state._uvMapScale[0] : this.uvMapScale[0]; };
		this.getUVMapHeightScale = ()=>{ return state._uvMapScale[1] ? state._uvMapScale[1] : this.uvMapScale[1]; };

	}

	destroy(state) 
	{
		this.scale = null;
		// this.scaleMult = 1;
		this.translation = null;
		this.rot = null;
		this.color = null;
		this.hsva = null;
		this.brushTexture = null;
		this.draw = null;
		this.fbo = null;		
	}

	activate(state)
	{
		super.activate(state);
		_vm_.$emit('changeMode', 'paint');
		// state.resizePaintSurf(state.getActiveChannelDimension())
		// state.paintSurfFbos[0].use(() => {
		// 	state.regl.clear({
		// 					// depth: 0,
		// 					// color: [1, 1, 1, 0]
		// 					color: [0, 0, 0, 0]
		// 				})
		// });
		this.fbo = state.paintSurfFbos[0];//state.paintState];
		this.fbo.use(() => {
				state.regl.clear({
								// depth: 0,
								// color: [1, 1, 1, 0]
								color: [0, 0, 0, 0]
							})
			});
	}

	strokeBegin(state) 
	{
		this.startPos = {x: state.currentMousePos.x, y: state.currentMousePos.y};
		log('strokeBegin');

		var brush = state.activeBrushStamp;
		log(brush);
		var ratio = brush.img.naturalWidth / brush.img.naturalHeight;
		var bbox = state.$refs.canvas.getBoundingClientRect();
		var aspectX = this.fbo.width / bbox.width;
		var aspectY = this.fbo.height / bbox.height;
		this.aspect = [aspectX, aspectY];

		log(`ratio[${ratio}], aspect[${this.aspect}]`);

		if (state.redoActionCount > 0)
		{
			state.clearRedoActions();
		}
		_vm_.$emit('registerUndoAction', state.currentAction ? null : createActionFromCurrentPaintSurface(state, this.fbo) );

		this.uvMapScale = [ this.fbo.width / state.regl._gl.drawingBufferWidth,
							this.fbo.height / state.regl._gl.drawingBufferHeight]

		this.frameUpdate = state.regl.frame( (time)=> {

			const vx = (this.startPos.x - state.currentMousePos.x) / aspectX;
			const vy = (this.startPos.y - state.currentMousePos.y) / aspectY;
			const dist = length([vx*this.getUVMapWidthScale(), vy*this.getUVMapHeightScale()]);
			// this.scale = [dist*ratio*aspectX, dist*aspectY];//[100, 100];//
			this.scale = [dist*ratio, dist];//[100, 100];//
			// this.scale = [dist*ratio/this.getUVMapWidthScale(), dist/this.getUVMapHeightScale()];//[100, 100];//
			this.rot = Math.atan2(vx, vy);// - 90*TO_RADIANS;
			this.translation = [this.startPos.x*this.getUVMapWidthScale(), 
								this.startPos.y*this.getUVMapHeightScale()];//[0,0];//
			this.color = state.brushColor;//[0, 1, 1, 1];// 

			// log(`${dist} ${this.rot} ${this.translation}`)
			// log(`${this.startPos.x},${this.startPos.y} ${state.currentMousePos.x},${state.currentMousePos.y}`)
			
			// state.paintSurfFbos[0].use(() => {
			this.fbo.use(() => {
				state.regl.clear({
								// depth: 0,
								// color: [1, 1, 1, 0]
								color: [0, 0, 0, 0]
							})
				this.draw()
			});
			// state.regl.clear({
			// 	color: [0, 1, 1, 1]
			// })
			// this.draw()
			state.drawCanvas()

			// state.lastMousePos = state.currentMousePos;
		} );
	}

	strokeEnd(state) 
	{
		this.frameUpdate && this.frameUpdate.cancel();
		this.frameUpdate = null;
		state.bakePaint(null);
	}

	onPointerMove(state) 
	{
		// var size = state.brushSize.map(num => num * this.scaleMult);
		state.circleCursor.r = 2;//lerp(size[0], size[1], state.currentMousePos.force);
		state.circleCursor.cy = state.currentMousePos.clientY;//-2*state.circleCursor.r;
		state.circleCursor.cx = state.currentMousePos.clientX;//-state.circleCursor.r;
		// log(state.circleCursor.r);
	}
}


export default ToolStamp