//------------------- Helpers -------------------//

// import Element from './element';

// accepts jQuery object, node list, string selector, then called a setup for each element

//Returns true if it is a DOM element
var isElement = function(o){
	return (
		typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
		o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
	);
}

// the map method allows for interpolating a value from one range of values to another
// example from the Arduino documentation: https://www.arduino.cc/en/Reference/Map
var map = function(x, in_min, in_max, out_min, out_max){
	return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

window.supportsMouse            = false;
window.supportsTouch            = false;
window.supportsPointer          = false;
window.supportsTouchForce       = false;
window.supportsTouchForceChange = false;

if (typeof window !== 'undefined') {
	// only attempt to assign these in a browser environment.
	// on the server, this is a no-op, like the rest of the library
	if (typeof Touch !== 'undefined') {
		// In Android, new Touch requires arguments.
		try {
			if (Touch.prototype.hasOwnProperty('force') || 'force' in new Touch()) {
				window.supportsTouchForce = true;
			}
		} catch (e) {}
	}
	window.supportsTouch            = 'ontouchstart'       in window.document && supportsTouchForce;
	window.supportsMouse            = 'onmousemove'        in window.document && !supportsTouch;
	window.supportsPointer          = 'onpointermove'      in window.document;
	window.supportsTouchForceChange = 'ontouchforcechange' in window.document;
}


if (module.exports) 
	module.exports = {
		// loopPressureElements: loopPressureElements,
		map: map,
		isElement: isElement
	};