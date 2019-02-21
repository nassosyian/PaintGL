'use strict'

class Tool {
	
	constructor(state, options) 
	{
		this.brushState = null;
	}

	destroy(state) 
	{
		
	}
	
	activate(state)
	{
		state.pointerStyle = null;
		if (this.brushState)
		{
			state.setBrushState(this.brushState);
			setTimeout(() => {
				_vm_.$emit('refresh-brush');
			}, 10);
		}
	}

	deactivate(state, erase)
	{
		this.brushState = state.getBrushState();


		state.tools.orbit.bakePaint(state, erase);
		state.pointerStyle = null;
	}

	strokeBegin(state) 
	{

	}

	strokeEnd(state) 
	{

	}

	strokeMove(state) 
	{
		
	}

	onPointerMove(state, e) 
	{
		
	}

}


export default Tool;