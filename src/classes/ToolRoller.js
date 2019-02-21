'use strict'

import Tool from './Tool.js'
// const glsl = require('glslify')
const mat4 = require('gl-mat4')
import glslVert from '../../shaders/roller-stroke.vert.glsl'
import glslFrag from '../../shaders/roller-stroke.frag.glsl'
import {lerp} from '../utils/lerp.js'
import {length, normalize} from 'gl-vec2'
import createEaser from '../utils/createEaser.js'
import simplify from 'simplify-js'
import bsplinePolyline from '../utils/bspline.js'
const TO_RADIANS = Math.PI / 180.0;

function rotate(pt, cos, sin)
{
	return [pt[0]*cos - pt[1]*sin, pt[0]*sin + pt[1]*cos];
}

function rotateX(pt, cos, sin) { return pt[0]*cos - pt[1]*sin; }
function rotateY(pt, cos, sin) { return pt[0]*sin + pt[1]*cos; }

class ToolRoller extends Tool 
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
			// func: {srcRGB: 'src alpha', srcAlpha: 'one', dstRGB: 'one minus src alpha', dstAlpha: 'one minus src alpha'}
			// func: {srcRGB: 'one', srcAlpha: 'one', dstRGB: 'one minus src alpha', dstAlpha: 'one minus src alpha'}
			func: {srcRGB: 'one', srcAlpha: 'one', dstRGB: 'one minus src alpha', dstAlpha: 'one'}
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
				// position: ([[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]),
				position: state.regl.this('verts'),
				uvs: ([[0, 0], [1, 0], [1, 1],  [0, 1]]),
				// uvs: state.regl.this('uvs'),
			},
			
			// count: 60,
			
			uniforms: {
				hsva: state.regl.this('hsva'),
				color: state.regl.this('color'),
				uResolution: ({viewportWidth, viewportHeight}) => [viewportWidth, viewportHeight],
				tex: state.regl.this('brushTexture'),
				// bgTex: state.regl.this('bgTexture'),
				projection: ({viewportWidth, viewportHeight}) =>
								mat4.ortho([],
									0, viewportWidth,
									0, viewportHeight,
									-10.0, 10.0)
			},
		})

		this.prevVerts = null;
		this.prevV = 0;
		this.verts = [];
		this.uvs = [];
		this.posList = [];
		this.normalRadians = [];
		
		this.startPos = {x: 0, y: 0};
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
		this.currentPos = null;

		

		this.easer = createEaser( (time, params) => {
			if (this.currentPos == null)
			{
				this.currentPos = {
					clientX: params.currentMousePos.clientX,
					clientY: params.currentMousePos.clientY,
					x: params.currentMousePos.x,
					y: params.currentMousePos.y,
					force: params.currentMousePos.force
				}
				this._strokeMove(params)

				return true;
			}
			else {
				const scale = 0.01;

				this.currentPos = {
					clientX: this.currentPos.clientX + (params.currentMousePos.clientX - this.currentPos.clientX)*scale,
					clientY: this.currentPos.clientY + (params.currentMousePos.clientY - this.currentPos.clientY)*scale,
					x: this.currentPos.x + (params.currentMousePos.x - this.currentPos.x)*scale,
					y: this.currentPos.y + (params.currentMousePos.y - this.currentPos.y)*scale,
					force: this.currentPos.force + (params.currentMousePos.force - this.currentPos.force)*scale
				}

				this._strokeMove(params)

				return (Math.round(this.currentPos.x)==params.currentMousePos.x &&
						Math.round(this.currentPos.y)==params.currentMousePos.y		)
			}
		})
	}

	destroy(state) 
	{
		this.scale = null;
		// this.scaleMult = 1;
		this.translation = null;
		this.rot = null;
		this.color = null;
		this.hsva = null;
		this.draw = null;
	}

	strokeBegin(state) 
	{
		this.startPos = {x: state.currentMousePos.x, y: state.currentMousePos.y};
		this.prevVerts = null;
		this.prevV = 0;
		this.prevNormal = null;
		this.prevLen = 0;
		this.posList = [];
		this.normalRadians = [];

		this.posList.push(state.currentMousePos);

		this.currentPos = {
			clientX: state.currentMousePos.clientX,
			clientY: state.currentMousePos.clientY,
			x: state.currentMousePos.x,
			y: state.currentMousePos.y,
			force: state.currentMousePos.force
		}
	}

	simplifyAndDraw(state)
	{
		// var pts = simplify(this.posList, 3, false);

		var pts = bsplinePolyline(this.posList.length, 3, this.posList)
		// log(JSON.stringify(pts))

		// state.rAF.request( (time) => 
		var tick = state.regl.frame( (ctx) => 
		{
			var prevPt, pt;
			var dx, dy, max;

			for (var i = 1; i < pts.length; i++)
			{
				prevPt = pts[i-1];
				pt = pts[i];
				dx = (pt.x - prevPt.x);
				dy = (pt.y - prevPt.y);
				// log(pt)
				max = Math.abs(dx) > Math.abs(dy) ? Math.abs(dx) : Math.abs(dy);
				// max = 3;

				if (max <= 0)
				{
					continue;
				}
				
				this.calcBrushBuffers(state, pt, dx, dy);

				state.paintSurfFbos[0].use(() => {
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
				state.draw()
			}	// for end

			state.lastMousePos = state.currentMousePos;
			tick.cancel();
		} );

	}

	strokeEnd(state) 
	{
		this.prevVerts = null;
		this.prevV = 0;
		this.easer(null)

		this.simplifyAndDraw(state)
		this.posList = [];
	}

	calcBrushBuffers(state, pos, dx, dy)
	{
		// log(`calcBrushBuffers ${count} ${dx} ${dy}`)

		var force = 1;//pos.force;

		var size = state.brushSize.map(num => num * this.scaleMult);
		const len = length([dx, dy]);
		// state.currentMousePos.length = len;

		// this.posList.push(state.currentMousePos);
		// if (this.posList.length > 10)
		// 	this.posList.shift();
		
		// if (this.posList.length >= 3)
		// {
		// 	var simplePts = simplify(this.posList, 4, false);
		// 	log(`${JSON.stringify(simplePts)}`);
		// 	dx = state.currentMousePos.x - simplePts[0].x;
		// 	dy = state.currentMousePos.y - simplePts[0].y;
		// }
		// else
		// {
		// 	dx = state.currentMousePos.x - this.posList[0].x
		// 	dy = state.currentMousePos.y - this.posList[0].y
		// }
		
		var norm = normalize([0,0], [dx, dy]);
		// this.normalRadians.push( Math.atan2(norm[0], norm[1]) )
		// if (this.normalRadians.length > 8) 
		// 	this.normalRadians.shift();
		// var avgRadians = this.normalRadians.reduce( (prev, current) => (prev + current)*0.5 );
		// norm = rotate([0, 1], Math.cos(avgRadians), Math.sin(avgRadians));

		// if (len <= 1)
		// {
		// 	// norm = this.prevNormal;
		// 	norm = normalize([0,0], [state.currentMousePos.x - this.posList[0].x,
		// 							state.currentMousePos.y - this.posList[0].y]);
		// }
		// else
		// {
		// 	norm = normalize([0,0], [dx, dy]);
		// }
		this.prevLen = len;
		this.prevNormal = norm;

		const transposed = rotate(norm, 0, -1);//90degrees //[ norm[1], norm[0] ];
		// log(`${dx} ${dy} ${transposed}`);
		const scale = state.brushPressureSize ? 
						lerp(size[0], size[1], force )
					:
						lerp(size[0], size[1], Math.random() )

		var pt3 = [ transposed[0] * scale, transposed[1] * scale ]
		var pt2 = [ -pt3[0], -pt3[1] ]
		pt2[0] += pos.x;
		pt2[1] += pos.y;

		pt3[0] += pos.x;
		pt3[1] += pos.y;

		var pt0 = [0, 0]
		var pt1 = [0, 0]
		if (this.prevVerts)
		{
			pt1[0] = this.prevVerts[2][0];
			pt1[1] = this.prevVerts[2][1];
			pt0[0] = this.prevVerts[3][0];
			pt0[1] = this.prevVerts[3][1];
		}
		else
		{
			const prevScale = state.brushPressureSize ? 
								lerp(size[0], size[1], state.lastMousePos.force )
							:
								lerp(size[0], size[1], Math.random() )
			pt0 = [ transposed[0] * prevScale, transposed[1] * prevScale ]
			pt1 = [ -pt0[0], -pt0[1] ]

			pt0[0] += state.lastMousePos.x;
			pt0[1] += state.lastMousePos.y;

			pt1[0] += state.lastMousePos.x;
			pt1[1] += state.lastMousePos.y;
		}

		this.verts = [pt0, pt1, pt2, pt3];
		// log(`${this.verts}`);
		this.prevVerts = [pt0, pt1, pt2, pt3];
		const widthScale = len / this.brushTexture.naturalWidth;
		var flow = state.brushStampOpacity.map( (num) => widthScale * num / 100.0 )
		var vStep = state.brushPressureFlow ?
						lerp(flow[0], flow[1], force )
					:
						lerp(flow[0], flow[1], Math.random() )
					;
		this.uvs = [[0, this.prevV], [1, this.prevV], [1, this.prevV+vStep],  [0, this.prevV+vStep]];
		this.prevV += vStep;

		// log('brushColor : '+JSON.stringify(state.brushColor))
		this.color =  (state.brushColor) ;
		this.hsva =  ([0,0,0,0]) ;
	}

	strokeMove(state)
	{
		// this.easer(state);
		this.posList.push(state.currentMousePos);

		if (this.posList.length > 10)
		{
			this.simplifyAndDraw(state)
			this.posList = this.posList.slice(10-3);
		}
	}

	_strokeMove(state) 
	{
		// log('onPointerMove')

		// state.regl.clear({
		// 			// depth: 0,
		// 			color: [1, 1, 1, 0]
		// 		})

		const pos = state.currentMousePos;
		if (!state.lastMousePos)
			state.lastMousePos = pos;
		const dX = (pos.x - state.lastMousePos.x);
		const dY = (pos.y - state.lastMousePos.y);
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

		state.rAF.request( (time) => {

			this.calcBrushBuffers(state, dX, dY);

			state.paintSurfFbos[0].use(() => {
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
			state.drawCanvas()

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


export default ToolRoller