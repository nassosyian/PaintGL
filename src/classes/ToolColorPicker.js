'use strict'

import Tool from './Tool.js'

class ToolColorPicker extends Tool
{
	constructor(state, options)
	{
		super(state, options)
	}

	strokeBegin(state)
	{
		this.strokeMove(state)
	}

	strokeMove(state) 
	{
		var pixel = state.regl.read({
			x:  state.currentMousePos.x,
			y:  state.currentMousePos.y,
			width: 1,
			height: 1,
			colorFormat: 'rgba',
		});

		// log(pixel);

		window._vm_.$emit('setColor', {r:pixel[0], g:pixel[1], b:pixel[2], a:(pixel[3]/255)});

		var size = state.brushSize.map(num => num * this.scaleMult);
		state.circleCursor.r = 4;
		state.circleCursor.cy = state.currentMousePos.clientY;//-2*state.circleCursor.r;
		state.circleCursor.cx = state.currentMousePos.clientX;//-state.circleCursor.r;

	}
}

export default ToolColorPicker;