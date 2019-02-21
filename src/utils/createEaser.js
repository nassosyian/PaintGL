'use strict'

const rAF = require('animation-frame')();


// lerpCallback(time, params) must return a bool => whether it should stop
function createEaser(lerpCallback)
{
	var start = null;
	var tick = null;

	return function _easer(params)
	{
		if (tick!==null)
		{
			rAF.cancel(tick)
			start = null;
		}
		if (params===null)
		{
			tick = null;
			return;
		}
			
		function lerp(time) 
		{
			if (start===null)
				start = time;
			
			var timeDiff = time - start;
			var shouldStop = lerpCallback.call(null, time, params)
			if (shouldStop)
			{
				tick = null;
				start = null;
			}
			else
			{
				tick = rAF.request( lerp );
			}
		}
	
		tick = rAF.request( lerp );
	}
}

export default createEaser;