/*
This is the base adapter from which all the other adapters extend.
*/
var Config = require('../config.js');

class Adapter{

	constructor(el, block, options){
		this.el = el;
		this.block = block;
		this.options = options;
		this.pressed = false;
		this.deepPressed = false;
		this.nativeSupport = false;
		this.runningPolyfill = false;
	this.runKey = Math.random();
	this.polyfillEvent = null;
	}

	setPressed(boolean){
		this.pressed = boolean;
	}

	setDeepPressed(boolean){
		this.deepPressed = boolean;
	}

	isPressed(){
		return this.pressed;
	}

	isDeepPressed(){
		return this.deepPressed;
	}

	add(event, set){
		this.el.addEventListener(event, set, false);
	}

	runClosure(method){
		if(method in this.block){
			// call the closure method and apply nth arguments if they exist
			this.block[method].apply(this.el, Array.prototype.slice.call(arguments, 1));
		}
	}

	fail(event, runKey){
		// if(Config.get('polyfill', this.options)){
		//   if(this.runKey === runKey){
		//     this.runPolyfill(event);
		//   }
	// } else 
	{
			this.runClosure('unsupported', event);
		}
	}

	bindUnsupportedEvent(){
		this.add(supportsTouch ? 'touchstart' : 'mousedown', (event) => this.runClosure('unsupported', event));
	}

	_startPress(event, isPollyfill){
		if(this.isPressed() === false){
			this.runningPolyfill = false;
			this.setPressed(true);
			this.runClosure('start', event, isPollyfill);
		}
	}

	_startDeepPress(event, isPollyfill){
		if(this.isPressed() && this.isDeepPressed() === false){
			this.setDeepPressed(true);
			this.runClosure('startDeepPress', event, isPollyfill);
		}
	}

	_changePress(force, event, isPollyfill){
		this.nativeSupport = true;
		this.runClosure('change', force, event, isPollyfill);
	}

	_endDeepPress(isPollyfill){
		if(this.isPressed() && this.isDeepPressed()){
			this.setDeepPressed(false);
			this.runClosure('endDeepPress', isPollyfill);
		}
	}

	_endPress(){
		if(this.runningPolyfill === false){
			if(this.isPressed()){
				this._endDeepPress();
				this.setPressed(false);
				this.runClosure('end');
			}
			this.runKey = Math.random();
			this.nativeSupport = false;
		} else {
			this.setPressed(false);
		}
	}

	deepPress(force, event){
		force >= 0.5 ? this._startDeepPress(event) : this._endDeepPress();
	}

	runPolyfill(event){
	this.polyfillEvent = event;
		this.increment = Config.get('polyfillSpeedUp', this.options) === 0 ? 1 : 10 / Config.get('polyfillSpeedUp', this.options);
		this.decrement = Config.get('polyfillSpeedDown', this.options) === 0 ? 1 : 10 / Config.get('polyfillSpeedDown', this.options);
		this.setPressed(true);
		this.runClosure('start', event, true/*isPollyfill*/);
		if(this.runningPolyfill === false){
			this.loopPolyfillForce(0, event);
		}
	}

	loopPolyfillForce(force, event){
		if(this.nativeSupport === false){
			if(this.isPressed()) {
				this.runningPolyfill = true;
				force = force + this.increment > 1 ? 1 : force + this.increment;
				this.runClosure('change', force, this.polyfillEvent, true/*isPollyfill*/);
				this.deepPress(force, this.polyfillEvent);
				setTimeout(this.loopPolyfillForce.bind(this, force, this.polyfillEvent), 10);
			} else {
				force = force - this.decrement < 0 ? 0 : force - this.decrement;
				if(force < 0.5 && this.isDeepPressed()){
					this.setDeepPressed(false);
					this.runClosure('endDeepPress', true/*isPollyfill*/);
				}
				if(force === 0){
					this.runningPolyfill = false;
					this.setPressed(true);
					this._endPress();
				} else {
					this.runClosure('change', force, this.polyfillEvent, true/*isPollyfill*/);
					this.deepPress(force, this.polyfillEvent);
					setTimeout(this.loopPolyfillForce.bind(this, force, this.polyfillEvent), 10);
				}
			}
		}
	}

}

export default Adapter;