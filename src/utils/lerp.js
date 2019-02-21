'use strict'


// Imprecise method, which does not guarantee v = v1 when t = 1, due to floating-point arithmetic error.
// This form may be used when the hardware has a native fused multiply-add instruction.
function lerp(a, b, t) 
{
	return a + (b-a)*t;
}

// Precise method, which guarantees v = v1 when t = 1.
function lerp_precise(a, b, t) 
{
	return (1 - t)*a + t*b;
}



export {
	lerp,
	lerp_precise
}