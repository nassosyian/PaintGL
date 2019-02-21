'use strict'


import DataTexture from '../classes/DataTexture'

function createActionFromCurrentPaintSurface(state, fbo)
{
	let tex = new DataTexture();
	tex.readFromFBO(state.regl, fbo);//state.paintState]);
	// tex.idx = window.orbitUndoIdx;

	return  {
		tool: 'paint',
		data: { tex: tex, /* idx: window.orbitUndoIdx++ */ },
		apply: (data) => 
		{
			log('reverting to texture '+data.idx);
			var currentAction = state.currentAction;
			if (!currentAction)
			{
				var redoAction = createActionFromCurrentPaintSurface(state, fbo);
				_vm_.$emit('registerCurrentAction', redoAction);
			}
			// data.tex.writeToTexture(state.paintSurfTextures[0]);
			data.tex.writeToTexture(fbo.color[0]);
			// _vm_.$emit('popUndo');
		}
	}
}


export {createActionFromCurrentPaintSurface};
