'use strict'

import Tool from './Tool.js'
// const glsl = require('glslify')
const mat4 = require('gl-mat4')
import {createActionFromCurrentPaintSurface} from '../utils/createPaintSurfAction.js'
import smearVert from '../../shaders/smear-stroke.vert.glsl'
import smearFrag from '../../shaders/smear-stroke.frag.glsl'
import cropRegionVert from '../../shaders/crop-region.vert.glsl'
import mergeLayersFrag from '../../shaders/merge-textures.frag.glsl'
import {lerp} from '../utils/lerp.js'
import {length} from 'gl-vec2'

const TO_RADIANS = Math.PI / 180.0;

function rotate(pt, cos, sin)
{
	return [pt[0]*cos - pt[1]*sin, pt[0]*sin + pt[1]*cos];
}

function rotateX(pt, cos, sin) { return pt[0]*cos - pt[1]*sin; }
function rotateY(pt, cos, sin) { return pt[0]*sin + pt[1]*cos; }

class ToolSmear extends Tool 
{
	vertShader() { return smearVert; }
	fragShader() { return smearFrag; }
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
				uvs: ([[0, 0], [1, 0], [1, 1],  [0, 1]]),
			},
			
			// count: 60,
			
			uniforms: {
				translation: state.regl.prop('translation'),
				stampOpacity: state.regl.prop('stampOpacity'),
				hsva: state.regl.prop('hsva'),
				color: state.regl.prop('color'),
				lastrot: state.regl.prop('lastrot'),
				rot: state.regl.prop('rot'),
				scale: state.regl.prop('scale'),
				// bg: state.regl.this('bgTexture'),
				// uStampOpacity: () => state.brushStampOpacity,
				uResolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
				tex: state.regl.this('brushTexture'),
				bgTex: state.regl.this('bgTexture'),
				projection: ({viewportWidth, viewportHeight}) =>
								mat4.ortho([],
									0, viewportWidth,
									0, viewportHeight,
									-10.0, 10.0)
			},

			instances: state.regl.this('stampCount')
		})

		this.copyStamp = state.regl(
		{
			vert: cropRegionVert,
			frag: mergeLayersFrag,
	
			depth: {
				enable: false
			},
			stencil: {
				enable: false,
			},
	
	
			// this converts the vertices of the mesh into the position attribute
			attributes: {
				// position: [ -4, -4, 4, -4, 0, 4 ]
				position: [ -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1 ],
				uvs: [ 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1 ]
			},
			// count: 3,
			count: 6,
			// attributes: {
				
			// 	position: this.regl.prop('verticesBuffer'),
			// 	// normal: this.regl.prop('normalsBuffer'),
			// 	uv: this.regl.prop('uvsBuffer')
			// },
	
			// and this converts the faces of the mesh into elements
			// elements: this.regl.prop('indeces'),
	
			uniforms: {
				// scale: state.regl.prop('scale'),
				size: state.regl.prop('size'),
				translation: state.regl.prop('translation'),
				rot: state.regl.prop('rot'),
				// fillColor: this.regl.prop('fillColor'),
				// layer: this.regl.prop('layers'),
				layer0: state.regl.prop('layer0'),
				layer1: state.regl.prop('layer1'),
				layer2: state.regl.prop('layer2'),
				layer3: state.regl.prop('layer3'),
				layer4: state.regl.prop('layer4'),
				layer5: state.regl.prop('layer5'),
				opacity: state.regl.prop('opacity'),
				layerCount: state.regl.prop('layerCount'),
			}
		})

		this.stampCount = 0;
		this.scale = [];
		this.scaleMult = 1;
		this.translation = [];
		this.rot = [];
		this.lastrot = [];
		this.color = [];
		this.hsva = [];
		this.stampOpacity = [];
		this.brushTexture = null;
		this.strokeLength = 0;

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
		this.stampOpacity = null;
		this.brushTexture = null;
		this.bgTexture = null;
		this.strokeLength = 0;
		this.strokeGapOverflow = 0;
		this.draw = null;
		this.fbo = null;		
	}

	activate(state)
	{
		super.activate(state);
		_vm_.$emit('changeMode', 'paint');

		this.bgTexture = state.regl.texture({type: 'float', format: 'rgba', /* flipY: true, */ premultiplyAlpha: false});
		this.tmpTexture = state.regl.texture({type: 'float', format: 'rgba', /* flipY: true, */ premultiplyAlpha: false});

		this.fbo = state.paintSurfFbos[0];//state.paintState];
		this.fbo.use(() => {
				state.regl.clear({
								// depth: 0,
								// color: [1, 1, 1, 0]
								color: [0, 0, 0, 0]
							})
			});
		this.stampFbo = state.regl.framebuffer({
			color: this.bgTexture,
			depthStencil: false,
		})
	}

	deactivate(state)
	{
		this.bgTexture && this.bgTexture.destroy();
		this.tmpTexture && this.tmpTexture.destroy();

		this.stampFbo.destroy();
		super.deactivate(state)
	}

	strokeBegin(state) 
	{
		if (state.redoActionCount > 0)
		{
			state.clearRedoActions();
		}
		_vm_.$emit('registerUndoAction', state.currentAction ? null : createActionFromCurrentPaintSurface(state, this.fbo) );

		this.uvMapScale = [ this.fbo.width / state.regl._gl.drawingBufferWidth,
							this.fbo.height / state.regl._gl.drawingBufferHeight]
		var bbox = state.$refs.canvas.getBoundingClientRect();
		var aspectX = this.fbo.width / bbox.width;
		var aspectY = this.fbo.height / bbox.height;
		this.aspect = [aspectX, aspectY];
	}

	strokeEnd(state) 
	{
		this.strokeLength = 0;
		this.strokeGapOverflow = 0;
	}

	calcBrushBuffers(state, count, dx, dy)
	{
		// log(`calcBrushBuffers ${count} ${dx} ${dy}`)
		const div_count = 1.0 / count;

		const stepX = dx * div_count;
		const stepY = dy * div_count;
		const forceStep = (state.currentMousePos.force - state.lastMousePos.force)*div_count;
		const len = length([dx, dy]);
		const lenStep = len * div_count;
		var gap = state.brushGap;
		// var remLen = len - this.strokeGapOverflow;
		var indeces = [];

		// function getForce(i) { return state.lastMousePos.force+i*forceStep }
		function getForce(i) { return state.lastMousePos.force+indeces[i]*forceStep }

		// log( state.brushPressureGap);
		if (gap[1] > 0)
		{
			var nextGap = 0;
			for (let i = Math.floor(this.strokeGapOverflow / lenStep); i < count; i++)
			{
				var dist = i * lenStep;
				if (dist >= nextGap)
				{
					var t = state.brushPressureGap ? (state.lastMousePos.force + i*forceStep) : Math.random();
					// var t = (state.lastMousePos.force + i*forceStep);
					nextGap = dist + lerp(gap[0], gap[1], t);
					indeces.push(i);
				}
			}
			this.strokeGapOverflow = Math.max(this.strokeGapOverflow - len, 0) + Math.max(0, nextGap - len);
			// while (remLen > 0)
			// {
			// 	var num = lerp(gap[0], gap[1], Math.random())
			// 	remLen -= num;
			// 	pts.push( num );
			// }
		}
		else 
		{
			indeces = Array(count).fill().map( (_, i)=>i )
		}

		this.stampCount = indeces.length;//count;
		

		// log(`${stepX} ${stepY}`);

		// this.scale && this.scale.destroy();
		// this.translation && this.translation.destroy();
		// this.rot && this.rot.destroy();
		// this.color && this.color.destroy();
		// this.hsva && this.hsva.destroy();
		// this.stampOpacity && this.stampOpacity.destroy();

		var size = state.brushSize.map(num => num * this.scaleMult);
		this.scale = Array(indeces.length)
					.fill( 
					// 	[size[0], size[0]]
					// 		.map( (num)=> num*this.scaleMult ) 
					)
					.map( state.brushPressureSize ?
						(_, i)=> {
							var s = lerp(size[0], size[1], getForce(i));
							// return [s / this.getUVMapWidthScale(), s / this.getUVMapHeightScale()];
							return [s*this.getUVMapWidthScale() * this.aspect[0], s*this.getUVMapHeightScale()*this.aspect[1]];
						} 
						:
						(_, i)=> {
							var s = lerp(size[0], size[1], Math.random() );
							// return [s / this.getUVMapWidthScale(), s / this.getUVMapHeightScale()];
							return [s*this.getUVMapWidthScale() * this.aspect[0], s*this.getUVMapHeightScale()*this.aspect[1]];
						} 
					) 
				;
		this.translation = Array(indeces.length).fill().map( 
			(_, i) => { 
				var p = [state.lastMousePos.x*this.getUVMapWidthScale() + i*stepX, 
						state.lastMousePos.y*this.getUVMapHeightScale() + i*stepY]; 
				// var p = [state.lastMousePos.x + i*stepX, state.lastMousePos.y + i*stepY]; 
				// var p = [state.lastMousePos.x + Math.random()*50, state.lastMousePos.y + Math.random()*50]; 
			// log(p);
			return /* Array(4).fill */(p);}
		);
		this.rot = Array(indeces.length).fill()
			.map(
				state.brushPressureRotation ?
				// (_, i) => { var r = Math.random()*2.0*Math.PI; return /* Array(4).fill */(r); }
				// (_, i) => 0.0
				(_, i) => lerp(state.brushRotation[0], state.brushRotation[1], getForce(i) )*TO_RADIANS
				:
				(_, i) => lerp(state.brushRotation[0], state.brushRotation[1], Math.random() )*TO_RADIANS
			);
		this.lastrot = [0].concat(this.rot);
		// log('brushColor : '+JSON.stringify(state.brushColor))
		this.color = Array(indeces.length).fill( (state.brushColor) );
		this.hsva = Array(indeces.length).fill( ([0,0,0,0]) );
		// this.stampOpacity = state.regl.buffer( Array(indeces.length).fill(1) );
		var flow = state.brushStampOpacity.map( (num) => num / 100.0 )
		this.stampOpacity = Array(indeces.length).fill()
			.map(
				state.brushPressureFlow ?
				(_, i) => lerp(flow[0], flow[1], getForce(i) )
				:
				(_, i) => lerp(flow[0], flow[1], Math.random() )
			) ;
	}

	strokeMove(state) 
	{
		// log('onPointerMove')

		// state.regl.clear({
		// 			// depth: 0,
		// 			color: [1, 1, 1, 0]
		// 		})

		const pos = state.currentMousePos;
		if (!state.lastMousePos)
			state.lastMousePos = pos;
		const dX = (pos.x - state.lastMousePos.x)*this.getUVMapWidthScale();
		const dY = (pos.y - state.lastMousePos.y)*this.getUVMapHeightScale();
		// log(pos)
		const max = Math.round( Math.abs(dX) > Math.abs(dY) ? Math.abs(dX) : Math.abs(dY) );
		
		// if (!state.lastMousePos.x || !state.lastMousePos.y)
		// 	debug

		// max = 3;

		// state.pointerStyle = {
		// 	cursor: this.getSvgUrl(state)
		// };

		if (max <= 0)
		{
			state.lastMousePos = pos;
			return;
		}
		
		const copyBgStamp = (i) =>
		{
			const width = Math.round(this.scale[i][0]);
			const height = Math.round(this.scale[i][1]);
			this.bgTexture({
				// size: this.scale[i],
				width,
				height,
				format: 'rgba',
				type: 'float',
				// flipY: true, 
				premultiplyAlpha: false
			})
			this.tmpTexture({
				// size: this.scale[i],
				width,
				height,
				format: 'rgba',
				type: 'float',
				// flipY: true, 
				premultiplyAlpha: false
			})
			this.stampFbo({
				// size: this.scale[i],
				width,
				height,
				color: this.bgTexture,
				// format: 'rgba',
				// type: 'float',
				depthStencil: false
			})
			// const cos = 1;//Math.cos(this.rot[i])
			// const sin = 0;//Math.sin(this.rot[i])
			// const pts = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].map(
			// 	(pt) => {
			// 		var x = pt[0] * this.scale[i][0];
			// 		var y = pt[1] * this.scale[i][1];
			// 		[x, y] = rotate([x, y], cos, sin);
			// 		return [ x + this.translation[i][0], y + this.translation[i][1] ]
			// 	}
			// );
			// const mins = pts.reduce((prev, current) => [Math.min(prev[0], current[0]), Math.min(prev[1], current[1])] );
			// const maxs = pts.reduce((prev, current) => [Math.max(prev[0], current[0]), Math.max(prev[1], current[1])] );

			// const uvpts = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(
			// 	(pt) => {
			// 		var x = pt[0] / this.scale[i][0];
			// 		var y = pt[1] / this.scale[i][1];
			// 		[x, y] = rotate([x, y], Math.cos(-this.rot[i]), Math.sin(-this.rot[i]) );
			// 		return [ x - this.translation[i][0] / this.fbo.width, 
			// 				y - this.translation[i][1] / this.fbo.height ]
			// 	}
			// );

			// const uvpts = [[0, 0], [0, 1], [1, 1], [1, 0]].map(
			// 	(pt) => {
			// 		var x = pt[0] - (this.translation[i][0] / this.fbo.width - 0.5*this.scale[i][0] / this.fbo.width);
			// 		var y = pt[1] - (this.translation[i][1] / this.fbo.height - 0.5*this.scale[i][1] / this.fbo.height);
			// 		x /= (this.scale[i][0] / this.fbo.width);
			// 		y /= (this.scale[i][1] / this.fbo.height);
			// 		return [x+0.5, y+0.5];
			// 		// [x, y] = rotate([x, y], Math.cos(-this.rot[i]), Math.sin(-this.rot[i]) );
			// 		// return [ x - this.translation[i][0] / this.fbo.width, 
			// 				// y - this.translation[i][1] / this.fbo.height ]
			// 	}
			// );

			// const data = [this.scale[i][0] / this.fbo.width, this.scale[i][1] / this.fbo.height, -this.translation[i][0] / this.fbo.width, this.translation[i][1] / this.fbo.height ];
			// log(`width[${width}] height[${height}] scale ${[this.scale[i][0] / this.fbo.width, this.scale[i][1] / this.fbo.height]} xform ${[this.translation[i][0] / this.fbo.width, this.translation[i][1] / this.fbo.height]} pts ${uvpts}`)
			// log(`width[${width}] height[${height}] pts ${ data }`)
			

			this.stampFbo.use( ()=>{
				// state.regl.clear({
				// 				// depth: 0,
				// 				color: [0, 1, 1, 1]
				// 			})
				this.copyStamp({
					// scale: [this.scale[i][0] / this.fbo.width, this.scale[i][1] / this.fbo.height],
					size: [this.scale[i][0] / this.fbo.width, this.scale[i][1] / this.fbo.height],
					rot:  this.rot[i],
					translation: [this.translation[i][0] / this.fbo.width, 
								this.translation[i][1] / this.fbo.height],
					layer0: state.viewerBaseColorTex,
					// layer1: state.viewerOverlayTex,
					layer1: state.paintSurfTextures[0],
					layer2: this.tmpTexture,
					layer3: this.tmpTexture,
					layer4: this.tmpTexture,
					layer5: this.tmpTexture,
					layerCount: 3,
					opacity: [1, 1, this.stampOpacity[i], 1, 1, 1, 1, 1, 1]
				});
				this.tmpTexture({copy: true, format:this.tmpTexture.format, type:this.tmpTexture.type});
			} )

			// try {
			// 	this.bgTexture({
			// 		copy: true,
			// 		x: Math.round(mins[0] / this.getUVMapWidthScale()),
			// 		y: Math.round(mins[1] / this.getUVMapHeightScale()),
			// 		width: Math.round((maxs[0] - mins[0]) / this.getUVMapWidthScale()),
			// 		height: Math.round((maxs[1] - mins[1]) / this.getUVMapHeightScale()),
			// 		type: 'float', format: 'rgba', flipY: true, premultiplyAlpha: false
			// 	})
			// } catch (error) {
			// 	// log(error);
			// }
		}

		state.rAF.request( (time) => {

			this.calcBrushBuffers(state, max, dX, dY);

			// state.paintState = (state.paintState + 1) & 1;
			// state.paintSurfTextures[state.paintState]({width: framebufferWidth, height: framebufferHeight});

			// state.paintSurfTextures[(state.paintState + 1) & 1]({copy: true})
			// this.bgTexture = state.paintSurfTextures[(state.paintState + 1) & 1];
			for (let i = 0; i < this.translation.length; i++)
			{
				copyBgStamp(i > 0 ? i-1 : 0)
				this.fbo.use(() => {
					// copyBgStamp(i > 0 ? i-1 : 0)
					
					// state.regl.clear({
					// 				// depth: 0,
					// 				color: [1, 1, 1, 0]
					// 			})
					this.draw({
						translation: this.translation[i],
						scale: this.scale[i],
						rot: this.rot[i],
						lastrot: this.lastrot[i],
						color: this.color[i],
						hsva: this.hsva[i],
						stampOpacity: this.stampOpacity[i],
					})
				});
	
				//()=>{
					// state.regl.clear({
					// 				// depth: 0,
					// 				color: [0, 0, 0, 1]
					// 			})
				// });
				state.drawCanvas()
				// state.paintSurfTextures[(state.paintState + 1) & 1]({copy: true})
				//()=>{
					// state.regl.clear({
						// 				// depth: 0,
						// 				color: [0, 1, 1, 1]
						// 			})
						// })
			}
			state.lastMousePos = state.currentMousePos;
		} );
	}

	onPointerMove(state) 
	{
		var size = state.brushSize.map(num => num * this.scaleMult);
		state.circleCursor.r = lerp(size[0], size[1], state.currentMousePos.force);
		state.circleCursor.cy = state.currentMousePos.clientY;//-2*state.circleCursor.r;
		state.circleCursor.cx = state.currentMousePos.clientX;//-state.circleCursor.r;
		// log(state.circleCursor.r);
	}
}


export default ToolSmear