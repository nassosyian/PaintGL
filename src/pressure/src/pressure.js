//--------------------- Public API Section ---------------------//
// this is the Pressure Object, this is the only object that is accessible to the end user
// only the methods in this object can be called, making it the "public api"

var Config = require('./config.js');
var helpers = require('./helpers.js');

import Element from './element.js';

var loopPressureElements = function(selector, closure, options = {}){
	// if a string is passed in as an element
	if(typeof selector === 'string' || selector instanceof String){
		var elements = document.querySelectorAll(selector);
		for (var i = 0; i < elements.length; i++) {
			new Element(elements[i], closure, options);
		}
	// if a single element object is passed in
	} else if(helpers.isElement(selector)){
		new Element(selector, closure, options);
	// if a node list is passed in ex. jQuery $() object
	} else {
		for (var i = 0; i < selector.length; i++) {
			new Element(selector[i], closure, options);
		}
	}
};


var Pressure = {

	// targets any device with Force or 3D Touch
	set(selector, closure, options){
		loopPressureElements(selector, closure, options);
	},

	// set configuration options for global config
	config(options){
		Config.set(options);
	},

	// the map method allows for interpolating a value from one range of values to another
	// example from the Arduino documentation: https://www.arduino.cc/en/Reference/Map
	map(x, in_min, in_max, out_min, out_max){
		return helpers.map.apply(null, arguments);
	}

};


export default Pressure;