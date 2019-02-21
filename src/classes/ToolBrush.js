'use strict'

import Tool from './Tool.js'
import DataTexture from './DataTexture'
const glsl = require('glslify')
const mat4 = require('gl-mat4')
import {createActionFromCurrentPaintSurface} from '../utils/createPaintSurfAction.js'
import glslVert from '../../shaders/brush-stroke.vert.glsl'
import glslFrag from '../../shaders/brush-stroke.frag.glsl'
import {lerp} from '../utils/lerp.js'
import {length} from 'gl-vec2'

const TO_RADIANS = Math.PI / 180.0;


class ToolBrush extends Tool 
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
				uvs: ([[0, 0], [1, 0], [1, 1],  [0, 1]]),

				translation: {
					buffer: state.regl.this('translation'),
					divisor: 1
				}
				,scale: {
					buffer: state.regl.this('scale'),
					divisor: 1
				}
				,rot: {
					buffer: state.regl.this('rot'),
					divisor: 1
				}
				,color: {
					buffer: state.regl.this('color'),
					divisor: 1
				}
				,hsva: {
					buffer: state.regl.this('hsva'),
					divisor: 1
				}
				,stampOpacity: {
					buffer: state.regl.this('stampOpacity'),
					divisor: 1
				}
			},

			// count: 60,

			uniforms: {
				// bg: state.regl.this('bgTexture'),
				// uStampOpacity: () => state.brushStampOpacity,
				// uResolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
				direction: state.regl.this('direction'),
				tex: state.regl.this('brushTexture'),
				projection: ({viewportWidth, viewportHeight}) =>
								mat4.ortho([],
									0, viewportWidth,
									0, viewportHeight,
									-10.0, 10.0)
				// projection: ({drawingBufferWidth, drawingBufferHeight}) =>
				// 				mat4.ortho([],
				// 					0, drawingBufferWidth,
				// 					0, drawingBufferHeight,
				// 					-10.0, 10.0)
			},

			instances: state.regl.this('stampCount')
		})

		this.stampCount = 0;
		this.scale = state.regl.buffer({usage:'dynamic', type:'float'});
		this.scaleMult = 1;
		this.translation = state.regl.buffer({usage:'dynamic', type:'float'});
		this.rot = state.regl.buffer({usage:'dynamic', type:'float'});
		this.color = state.regl.buffer({usage:'dynamic', type:'float'});
		this.hsva = state.regl.buffer({usage:'dynamic', type:'float'});
		this.stampOpacity = state.regl.buffer({usage:'dynamic', type:'float'});
		this.brushTexture = null;
		this.bgTexture = null;
		this.strokeLength = 0;
		this.alignAngles = [];
		this.histPos = [];

		this.fbo = null;
		
		this.uvMapScale = [1, 1];
		this.getUVMapWidthScale = ()=>{ return state._uvMapScale[0] ? state._uvMapScale[0] : this.uvMapScale[0]; };
		this.getUVMapHeightScale = ()=>{ return state._uvMapScale[1] ? state._uvMapScale[1] : this.uvMapScale[1]; };
		this.aspect = [1, 1];
	}

	destroy(state) 
	{
		this.scale && this.scale.destroy();
		// this.scaleMult && this.scaleMult.destroy();
		this.translation && this.translation.destroy();
		this.rot && this.rot.destroy();
		this.color && this.color.destroy();
		this.hsva && this.hsva.destroy();
		this.stampOpacity && this.stampOpacity.destroy();
		// this.brushTexture && this.brushTexture.destroy();

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
		this.aspect = null;
	}

	// getSvgUrl(state)
	// {
	// 	const dim = state.brushSize[1] * this.scaleMult;
	// 	var width = dim;
	// 	var height = dim;
	// 	return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><circle stroke="black" cx="${dim}" cy="${dim}" r="${dim}"/></svg>') ${dim/2} ${dim/2}, auto`;
	// }

	activate(state)
	{
		super.activate(state);
		_vm_.$emit('changeMode', 'paint');
		state.refreshMesh = true;
		state.drawCanvas()
		// state.resizePaintSurf(Math.max(state.VIEWER_WIDTH_POT, state.VIEWER_HEIGHT_POT))
		// state.resizePaintSurf(state.getActiveChannelDimension())
		this.fbo = state.paintSurfFbos[0];//state.paintState];
		function checkFbo()
		{
			var fboError = state.regl._gl.checkFramebufferStatus(state.regl._gl.FRAMEBUFFER);
			if (fboError != state.regl._gl.FRAMEBUFFER_COMPLETE)
				console.error('framebuffer error: ', fboError)
		}
		// if (this.fbo.width != this.fbo.color[0].width)	debugger
		// this.fbo.use(() => {
		// 		// try 
		// 		{
		// 			state.regl.clear({
		// 							// depth: 0,
		// 							// color: [1, 1, 1, 0]
		// 							color: [0, 0, 0, 0]
		// 						})
		// 			// checkFbo()
		// 		}
		// 		// catch(error)
		// 		// {
		// 		// 	// debugger
		// 		// }
		// 	});
		// state.pointerStyle = this.getSvgUrl(state);
		// log(state.pointerStyle)
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
		this.histPos = [];
	}

	strokeEnd(state) 
	{
		this.strokeLength = 0;
		this.strokeGapOverflow = 0;
		this.alignAngles = [];
		this.histPos = [];
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

		if (this.histPos.length == 0)
			this.histPos.push([dx, dy])
		else
			this.histPos.push([this.histPos[this.histPos.length-1][0]+dx, this.histPos[this.histPos.length-1][1]+dy])

		if (this.histPos.length > 5)	this.histPos.shift();

		const normDir = [dx / len, dy / len];
		this.direction = normDir;
		var angle = -Math.atan2(normDir[1], normDir[0]) * 180.0 / Math.PI;
		if (this.histPos.length > 1 && state.brushAlign[0] > 0.0 && state.brushAlign[1] > 0.0)
		{
			// var list = JSON.stringify(this.histPos);
			var last = this.histPos.length-1;
			var vec = [this.histPos[last][0] - this.histPos[0][0], this.histPos[last][1] - this.histPos[0][1]];
			var veclen = length(vec);
			vec = [ vec[0] / veclen, vec[1] / veclen ];
			angle = -Math.atan2(vec[1], vec[0]) * 180.0 / Math.PI;
			// log([dx, dy], JSON.stringify(this.histPos), angle);
		}

		// this.alignAngles.push(angle);
		// if (this.alignAngles.length > 4)	this.alignAngles.pop();
		// const alignAngle = this.alignAngles.reduce(( acc, cur ) => (acc+cur)) / this.alignAngles.length;
		const alignAngle = angle;
		const normT = [-normDir[1], normDir[0]]; // rotated 90 degrees around (0, 0)

		// function getForce(i) { return state.lastMousePos.force+i*forceStep }
		function getForce(i) { return state.lastMousePos.force+indeces[i]*forceStep }

		// log( state.brushPressureGap);
		// log('gap: '+JSON.stringify(gap) )
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

		this.scale && this.scale.destroy();
		this.translation && this.translation.destroy();
		this.rot && this.rot.destroy();
		this.color && this.color.destroy();
		this.hsva && this.hsva.destroy();
		this.stampOpacity && this.stampOpacity.destroy();

		var size = state.brushSize.map(num => num * this.scaleMult);
		this.scale = state.regl.buffer( Array(indeces.length)
					.fill( 
					// 	[size[0], size[0]]
					// 		.map( (num)=> num*this.scaleMult ) 
					)
					.map( state.brushPressureSize ?
						(_, i)=> {
							var s = lerp(size[0], size[1], getForce(i));
							return [s*this.getUVMapWidthScale() * this.aspect[0], s*this.getUVMapHeightScale()*this.aspect[1]];
							// return [s, s];
						} 
						:
						(_, i)=> {
							var s = lerp(size[0], size[1], Math.random() );
							return [s*this.getUVMapWidthScale() * this.aspect[0], s*this.getUVMapHeightScale()*this.aspect[1]];
							// return [s, s];
						} 
					) 
				);
		this.translation = state.regl.buffer( Array(indeces.length).fill().map( 
			(_, i) => { 
				var p = [state.lastMousePos.x*this.getUVMapWidthScale() + i*stepX, 
						 state.lastMousePos.y*this.getUVMapHeightScale() + i*stepY]; 
				var t = state.brushPressureOffset ? 0.5 + getForce(i)*(Math.random()-0.5) : 0.5 + (Math.random()-0.5) ;
				var offs = lerp(state.brushOffset[0], state.brushOffset[1], t);
				if (offs != 0.0)
				{
					p[0] += normT[0]*offs;
					p[1] += normT[1]*offs;
				}
				// var p = [state.lastMousePos.x + Math.random()*50, state.lastMousePos.y + Math.random()*50]; 
			// log(p);
			return /* Array(4).fill */(p);}
		));
		var rotArray = Array(indeces.length).fill()
						.map(
							state.brushPressureRotation ?
							// (_, i) => { var r = Math.random()*2.0*Math.PI; return /* Array(4).fill */(r); }
							// (_, i) => 0.0
							(_, i) => lerp(state.brushRotation[0], state.brushRotation[1], getForce(i) )
							:
							(_, i) => lerp(state.brushRotation[0], state.brushRotation[1], Math.random() )
						)
						.map(
							state.brushPressureAlign ? 
							(v, i) => ((lerp(state.brushAlign[0], state.brushAlign[1], getForce(i))*0.01*alignAngle + v) % 360)*TO_RADIANS
							:
							(v, i) => ((lerp(state.brushAlign[0], state.brushAlign[1], Math.random())*0.01*alignAngle + v) % 360)*TO_RADIANS
						)
						;
		this.rot = state.regl.buffer( rotArray );
		// log('brushColor : '+JSON.stringify(state.brushColor))
		this.color = state.regl.buffer( Array(indeces.length).fill( (state.brushColor) ));

		// log(state.brushHue[0], state.brushHue[1]);

		// var satDiff = ;
		// this.hsva = state.regl.buffer( Array(indeces.length).fill( ([0,0,0,0]) ));
		this.hsva = state.regl.buffer( Array(indeces.length)
		.fill( 
		// 	[size[0], size[0]]
		// 		.map( (num)=> num*this.scaleMult ) 
		)
		.map( 
			(_, i)=> {
				var h = lerp(state.brushHue[0], state.brushHue[1], state.brushPressureHue ? getForce(i) : Math.random());
				var s = lerp(state.brushSaturation[0], state.brushSaturation[1], state.brushPressureSaturation ? getForce(i) : Math.random());
				var v = lerp(state.brushLuminance[0], state.brushLuminance[1], state.brushPressureLuminance ? getForce(i) : Math.random());

				return [h / 100.0, s / 100.0, v / 100.0, 1];
			} 
			) 
		);

		// this.stampOpacity = state.regl.buffer( Array(indeces.length).fill(1) );
		var flow = state.brushStampOpacity.map( (num) => num / 100.0 )
		this.stampOpacity = state.regl.buffer( Array(indeces.length).fill()
			.map(
				state.brushPressureFlow ?
				(_, i) => lerp(flow[0], flow[1], getForce(i) )
				:
				(_, i) => lerp(flow[0], flow[1], Math.random() )
			) );
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

		this.direction = [dX, dY];
		
		// state.rAF.request( (time) => {
		var tick = state.regl.frame( (ctx) => {

			this.calcBrushBuffers(state, max, dX, dY);

			// state.paintState = (state.paintState + 1) & 1;
			// state.paintSurfTextures[state.paintState]({width: framebufferWidth, height: framebufferHeight});
			this.fbo.use(() => {
				// state.regl.clear({
				// 				// depth: 0,
				// 				color: [1, 1, 1, 0]
				// 			})
				this.draw()
			});


			//()=>{
				// state.regl.clear({
				// 				// depth: 0,
				// 				color: [0, 0, 0, 1]
				// 			})
			// });
			state.lastMousePos = state.currentMousePos;
			state.drawCanvas()
			// state.paintSurfTextures[(state.paintState + 1) & 1]({copy: true})
			//()=>{
				// state.regl.clear({
				// 				// depth: 0,
				// 				color: [0, 1, 1, 1]
				// 			})
			// })

			tick.cancel();
		} );
	}

	onPointerMove(state) 
	{
		var size = state.brushSize.map(num => num * this.scaleMult);
		state.circleCursor.r = lerp(size[0], size[1], state.currentMousePos.force);
		state.circleCursor.cx = state.currentMousePos.clientX;//-state.circleCursor.r;
		state.circleCursor.cy = state.currentMousePos.clientY;//-2*state.circleCursor.r;
		// log(state.circleCursor.r);
	}
}


export default ToolBrush