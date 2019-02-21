'use strict'

const pako = require('pako'); // zip compress/uncompress
const base64js = require('base64-js');
// const UPNG = require('upng-js');
const UPNG = require('../utils/UPNG.js');
const PNG = require('pngjs').PNG;
// const Buffer = require('buffer').Buffer;

class DataTexture {
	constructor(options)
	{
		options = options || {};
		Object.assign(this, options);
		this.data = options.data || null;
		this.width = options.width || 0;
		this.height = options.height || 0;
		// Power of 2 
		this.potSize = pow2ceil(options.size || Math.max(this.width, this.height) || 1);
		this.type = options.type || 'uint8';
		this.format = options.format || 'rgba';
		this.isCompressed = options.isCompressed || false;
		this.label = options.label || '';
	}

	clone()
	{
		var ret = new DataTexture(this);
		if (this.data)
			ret.data = this.data.slice(); // clone the data

		return ret;
	}

	alloc(isNormal)
	{
		if (!this.data)
		{
			var count = 4;
			switch (this.format)
			{
				default:
				case 'rgba': count = 4; break;
				case 'rgb': count = 3; break;
				case 'depth': 
				case 'alpha': 
				case 'luminance': 
						count = 1; break;
			}
			
			var size = 1;
			switch (this.type)
			{
				default:
				case 'uint8': 
				case 'int8': 
					this.data = new Uint8Array(count*this.width*this.height)
					break;
					
				case 'uint16': 
				case 'int16': 
					this.data = new Uint16Array(count*this.width*this.height)
					break;
					
				case 'uint32': 
				case 'int32': 
					this.data = new Uint32Array(count*this.width*this.height)
					break;
					
				case 'half float': 
				case 'float': 
					this.data = new Float32Array(count*this.width*this.height)
					break;
			}
		}
		// else
		{
			if (isNormal)
			{
				for (var i = 0; i < this.data.length; i += 4)
				{
					this.data[i + 0] = 0.5;
					this.data[i + 1] = 0.5;
					this.data[i + 2] = 1.0;
					this.data[i + 3] = 0.0;
				}
			}
			else
			{
				this.data.fill(0);
			}
		}
	}

	checkIsEmpty()
	{
		var nonEmpty = false;
		var buffer = new Uint8Array(this.data);
		for (var i = 0; nonEmpty==false && i < buffer.length; i++)
			nonEmpty |= (buffer[i]!=0);
		return !nonEmpty;
	}

	PNGtoRGBA16(out)
	{
		var w = out.width, h = out.height;
		if(out.tabs.acTL==null) return [this.decodePNG16( out.data, w, h, out).buffer];
		
		var frms = [];
		if(out.frames[0].data==null) out.frames[0].data = out.data;
		
		var img, empty = new Uint16Array(w*h*4);
		for(var i=0; i<out.frames.length; i++)
		{
			var frm = out.frames[i];
			var fx=frm.rect.x, fy=frm.rect.y, fw = frm.rect.width, fh = frm.rect.height;
			var fdata = UPNG.toRGBA8.decodeImage(frm.data, fw,fh, out);
			
			if(i==0) img = fdata;
			else if(frm.blend  ==0) UPNG._copyTile(fdata, fw, fh, img, w, h, fx, fy, 0);
			else if(frm.blend  ==1) UPNG._copyTile(fdata, fw, fh, img, w, h, fx, fy, 1);
			
			frms.push(img.buffer);  img = img.slice(0);
			
			if     (frm.dispose==0) {}
			else if(frm.dispose==1) UPNG._copyTile(empty, fw, fh, img, w, h, fx, fy, 0);
			else if(frm.dispose==2) {
				var pi = i-1;
				while(out.frames[pi].dispose==2) pi--;
				img = new Uint16Array(frms[pi]).slice(0);
			}
		}
		return frms;
	}

	// *INTERNALL*
	decodePNG16(imgdata, w, h, out)
	{
		var data = new Uint16Array(imgdata.buffer);
		var area = w*h, bpp = UPNG.decode._getBPP(out);
		var bpl = Math.ceil(w*bpp/8);	// bytes per line

		var bf = new Uint16Array(area*4), bf32 = new Uint32Array(bf.buffer);
		var ctype = out.ctype, depth = out.depth;
		var rs = UPNG._bin.readUshort;
		
		//log(ctype, depth);

		if (ctype==6)  // RGB + alpha
		{
			var qarea = area<<2;
			// if(depth== 8) for(var i=0; i<qarea;i++) {  bf[i] = data[i];  /*if((i&3)==3 && data[i]!=0) bf[i]=255;*/ }
			if(depth==16) for(var i=0; i<qarea;i++) {  bf[i] = data[i];  }
		}
		else if(ctype==2) 	// RGB
		{
			var ts=out.tabs["tRNS"], tr=-1, tg=-1, tb=-1;
			if(ts) {  tr=ts[0];  tg=ts[1];  tb=ts[2];  }
			// if(depth== 8) 
			if(depth== 16) 
				for(var i=0; i<area; i++) 
				{  
					var qi=i<<2, ti=i*3;  bf[qi] = data[ti];  bf[qi+1] = data[ti+1];  bf[qi+2] = data[ti+2];  bf[qi+3] = 255;
					if(tr!=-1 && data[ti]   ==tr && data[ti+1]   ==tg && data[ti+2]   ==tb) bf[qi+3] = 0;  
				}
			// if(depth==16) 
			// 	for(var i=0; i<area; i++) 
			// 	{
			// 		var qi=i<<2, ti=i*6;  bf[qi] = data[ti];  bf[qi+1] = data[ti+2];  bf[qi+2] = data[ti+4];  bf[qi+3] = 255;
			// 		if(tr!=-1 && rs(data,ti)==tr && rs(data,ti+2)==tg && rs(data,ti+4)==tb) bf[qi+3] = 0;  
			// 	}
		}
		else if(ctype==3) {	// palette
			var p=out.tabs["PLTE"], ap=out.tabs["tRNS"], tl=ap?ap.length:0;
			//log(p, ap);
			if(depth==1) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>3)]>>(7-((i&7)<<0)))& 1), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==2) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>2)]>>(6-((i&3)<<1)))& 3), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==4) for(var y=0; y<h; y++) {  var s0 = y*bpl, t0 = y*w;
				for(var i=0; i<w; i++) { var qi=(t0+i)<<2, j=((data[s0+(i>>1)]>>(4-((i&1)<<2)))&15), cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
			}
			if(depth==8) for(var i=0; i<area; i++ ) {  var qi=i<<2, j=data[i]                      , cj=3*j;  bf[qi]=p[cj];  bf[qi+1]=p[cj+1];  bf[qi+2]=p[cj+2];  bf[qi+3]=(j<tl)?ap[j]:255;  }
		}
		else if(ctype==4) {	// gray + alpha
			if(depth== 16)  for(var i=0; i<area; i++) {  var qi=i<<2, di=i<<1, gr=data[di];  bf[qi]=gr;  bf[qi+1]=gr;  bf[qi+2]=gr;  bf[qi+3]=data[di+1];  }
			// if(depth==16)  for(var i=0; i<area; i++) {  var qi=i<<2, di=i<<2, gr=data[di];  bf[qi]=gr;  bf[qi+1]=gr;  bf[qi+2]=gr;  bf[qi+3]=data[di+2];  }
		}
		else if(ctype==0) {	// gray
			var tr = out.tabs["tRNS"] ? out.tabs["tRNS"] : -1;
			if(depth== 1) for(var i=0; i<area; i++) {  var gr=255*((data[i>>3]>>(7 -((i&7)   )))& 1), al=(gr==tr*255)?0:255;  bf32[i]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
			if(depth== 2) for(var i=0; i<area; i++) {  var gr= 85*((data[i>>2]>>(6 -((i&3)<<1)))& 3), al=(gr==tr* 85)?0:255;  bf32[i]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
			if(depth== 4) for(var i=0; i<area; i++) {  var gr= 17*((data[i>>1]>>(4 -((i&1)<<2)))&15), al=(gr==tr* 17)?0:255;  bf32[i]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
			// if(depth== 8) for(var i=0; i<area; i++) {  var gr=data[i  ] , al=(gr           ==tr)?0:255;  bf32[i]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
			if(depth==16) for(var i=0; i<area; i++) {  var gr=data[i], al=(rs(data,i)==tr)?0:255;  bf32[i]=(al<<24)|(gr<<16)|(gr<<8)|gr;  }
		}
		return bf;
	}


	readFromPNGFile(file)
	{
		const reader = new FileReader();

		function checkEmpty(data)
		{
			var nonEmpty = false;
			var buffer = new Uint8Array(data);
			for (var i = 0; nonEmpty==false && i < buffer.length; i++)
				nonEmpty |= (buffer[i]!=0);
			return !nonEmpty;
		}

		return new Promise( (resolve, reject)=>
		{
			if (file.name.toLowerCase().indexOf('.png') == -1 )
			{
				reject(`Error: "${file.name}" is not a PNG image file.`);
				return;
			}

			reader.onerror = (e) =>
			{
				log(e.error);
				reject(e.error);
			};

			reader.onload = (e) =>
			{
				var imgData = null;
				// log('.obj file');
				log('texture load');


				//=======PNGJS

				// try 
				// {
				// 	imgData = PNG.sync.read(new Buffer(e.target.result) );
				// 	// Sanity check
				// 	if (checkEmpty(imgData.data))
				// 		(console.error || log)(`Error: "${file.name}" texture decoded empty.`)
				// } 
				// catch (error) 
				// {
				// 	log(error)
				// 	reject(error);
				// }

				// this.width = imgData.width;
				// this.height = imgData.height;
				// this.potSize = pow2ceil(Math.max(this.width, this.height));
				// this.type = 'uint8';
				// if (imgData.depth < 16)
				// {
				// 	this.data = imgData.data;
				// }
				// else
				// {
				// 	// this.type = 'uint16';
				// 	// this.data = new Uint16Array(UPNG.PNGtoRGBA16(imgData)[0]);
				// 	this.type = 'float';
				// 	let input = new Uint16Array(imgData.data);
				// 	const len = input.length;
				// 	this.data = new Float32Array(len);
				// 	const scale = 1.0 / 0xFFFF;
				// 	for (let i = 0; i < len; i++)	this.data[i] = input[i]*scale;
				// }
				// // Sanity check
				// // if (checkEmpty(this.data))
				// // 	(console.error || log)(`Error: "${file.name}" texture loaded empty.`)

				// // this.label = file.name.slice(0, file.name.toLowerCase().indexOf('.png'));
				// this.label = file.name;
				// imgData = null;
				// resolve(this);



				//=======UPNG
				try 
				{
					imgData = UPNG.decode(e.target.result)
					// Sanity check
					// if (checkEmpty(imgData))
					// 	(console.error || log)(`Error: "${file.name}" texture decoded empty.`)
				} 
				catch (error) 
				{
					log(error)
					reject(error);
				}

				this.width = imgData.width;
				this.height = imgData.height;
				this.potSize = pow2ceil(Math.max(this.width, this.height));
				this.type = 'uint8';
				if (imgData.depth < 16)
				{
					this.data = new Uint8Array(UPNG.toRGBA8(imgData)[0]);
				}
				else
				{
					// this.type = 'uint16';
					// this.data = new Uint16Array(UPNG.PNGtoRGBA16(imgData)[0]);
					this.type = 'float';
					let input = new Uint16Array(UPNG.toRGBA16(imgData)[0]);
					const len = this.width*this.height*4;
					this.data = new Float32Array(len);
					const scale = 1.0 / 0xFFFF;
					for (let i = 0; i < len; i++)	this.data[i] = input[i]*scale;

				}
				// Sanity check
				// if (checkEmpty(this.data))
				// 	(console.error || log)(`Error: "${file.name}" texture loaded empty.`)

				// this.label = file.name.slice(0, file.name.toLowerCase().indexOf('.png'));
				this.label = file.name;
				resolve(this);
			};

			setTimeout(() => {
				reader.readAsArrayBuffer(file);
			}, 50);

		} );
	}

	readFromFBO(regl, fbo)
	{
		fbo.use(()=>
		{
			this.data = regl.read();
			this.isCompressed = false;
			// log('readFromFBO: '+(typeof this.data));
			// log(fbo._framebuffer);
			this.width = fbo.width;
			this.height = fbo.height;
			this.potSize = pow2ceil(Math.max(this.width, this.height) || 1);
			this.format = fbo.color[0].format;
			if (this.data instanceof Float32Array)
				this.type = 'float'
			else if (this.data instanceof Uint8Array)
				this.type = 'uint8'
			else if (this.data instanceof Uint16Array)
				this.type = 'uint16'
			else if (this.data instanceof Uint32Array)
				this.type = 'uint32'
			// else if (fbo._framebuffer.colorAttachments[0].target == 3553)
			// 	this.type = 'uint8'
		});
	}

	convertToUInt8(auxData)
	{
		auxData = auxData || this.data;

		var count = 4;
		switch (this.format)
		{
			default:
			case 'rgba': count = 4; break;
			case 'rgb': count = 3; break;
			case 'depth': 
			case 'alpha': 
			case 'luminance': 
					count = 1; break;
		}
		
		var out = new Uint16Array(count*this.width*this.height);
		switch (this.type)
		{
			default:
			case 'uint8': 
			case 'int8': 
				out = auxData;
				break;
				
			case 'uint16': 
			case 'int16': 
				for (var i = 0; i < auxData.length; i++)
				{
					out[i] = (auxData[i] >> 8);
				}
				break;
				
			case 'uint32': 
			case 'int32': 
				for (var i = 0; i < auxData.length; i++)
				{
					out[i] = auxData[i] >> 24;
				}
				break;
				
			case 'half float': 
			case 'float': 
				for (var i = 0; i < auxData.length; i++)
				{
					out[i] = Math.floor(auxData[i] * 0xFF);
				}
				break;
		}

		return out;
	}


	convertToUInt16(auxData)
	{
		auxData = auxData || this.data;

		var count = 4;
		switch (this.format)
		{
			default:
			case 'rgba': count = 4; break;
			case 'rgb': count = 3; break;
			case 'depth': 
			case 'alpha': 
			case 'luminance': 
					count = 1; break;
		}
		
		var out = new Uint16Array(count*this.width*this.height);
		switch (this.type)
		{
			default:
			case 'uint8': 
			case 'int8': 
				for (var i = 0; i < auxData.length; i++)
				{
					out[i] = auxData[i] ;//* 0xFF;
				}

				break;
				
			case 'uint16': 
			case 'int16': 
				// for (var i = 0; i < this.data.length; i++)
				// {
				// 	out[i] = ((this.data[i] & 0xFF) << 8) | (this.data[i] >> 8);
				// }
				out = auxData;
				break;
				
			case 'uint32': 
			case 'int32': 
				for (var i = 0; i < auxData.length; i++)
				{
					out[i] = auxData[i] >> 16;
					// out[i] = ((out[i] & 0xFF) << 8) | (out[i] >> 8);
				}
				break;
				
			case 'half float': 
			case 'float': 
				for (var i = 0; i < auxData.length; i++)
				{
					out[i] = Math.floor(auxData[i] * 0xFFFF);
					// out[i] = ((out[i] & 0xFF) << 8) | (out[i] >> 8);
				}
				break;
		}

		return out;
	}


	flipYData(data, lineBytes)
	{
		const len = data.byteLength >> 2;
		var input = new Uint32Array(data.buffer);
		var ret = new Uint32Array(len);
		
		const stride = lineBytes >> 2;
		const y = data.byteLength / lineBytes;

		for (let i = 0; i < y; i++)
		{
			var x = i*stride;
			var lastX = len - (i+1)*stride;
			if (x < 0 || lastX < 0)	debugger;
			for (var j = 0; j < stride; j++)
				ret[x+j] = input[lastX+j];
		}

		// // validate
		// for (let i = 0; i < y; i++)
		// {
		// 	var x = i*stride;
		// 	var lastX = len - (i+1)*stride;
		// 	if (x < 0 || lastX < 0)	debugger;
		// 	for (var j = 0; j < stride; j++)
		// 		if (input[x+j] !== ret[lastX+j])
		// 		{
		// 			console.error("flipYData error: flipped data doesn't match");
		// 			break;
		// 		}
		// }
		return ret;
	}

	writeToTexture(texture, options)
	{
		if (this.isCompressed)	this.uncompress();

		var format = '';
		var type = '';
		switch (this.type) {
			case DataTexture.RGBA_8:
				format = 'rgba';
				type = 'uint8';				
				break;
			case DataTexture.RGBA_F32:
				format = 'rgba';
				type = 'float';				
				break;
			case DataTexture.RGB_8:
				format = 'rgb';
				type = 'uint8';				
				break;
			case DataTexture.RGB_F32:
				format = 'rgb';
				type = 'float';				
				break;
	
			case DataTexture.UINT8:
				format = 'alpha';
				type = 'uint8';				
				break;
			case DataTexture.FLOAT32:
				format = 'alpha';
				type = 'float';				
				break;

			default:
				format = this.format;
				type = this.type;
				break;
		}
		var opt = Object.assign({
						width: this.width,
						height: this.height,
						data: this.data,
						format: format,
						type: type,
					}, options || {});

		// if (this.width != texture.width || this.height != texture.height)
		// {
		// 	console.error(`writeToTexture: different sizes (${this.width}, ${this.height})!=(${texture.width}, ${texture.height})`)
		// }
		texture(opt);
	}

	drawToCanvas2D(ctx, auxData)
	{
		var imageData = ctx.getImageData(0, 0, this.width, this.height);
		// var data = imageData.data;
		// imageData.data.set(this.data);
		var data = auxData || this.data;
		imageData.data.set(this.convertToUInt8(data));
		ctx.putImageData(imageData, 0, 0);
	}

	compress()
	{
		if (!this.data || this.isCompressed)
			return null;

		var data = this.data;
		// if (this.type != 'uint8')
		{
			data = new Uint8Array(this.data.buffer);
		}
		var origLength = this.data.length;
				
		var compressed = pako.deflate(data);
		this.data = compressed;
		this.isCompressed = true;

		log('orignal size: '+origLength+', compressed: '+compressed.length);

		return true;
	}

	uncompress()
	{
		if (!this.isCompressed)
			return;
		this.data = pako.inflate(this.data);
		if (this.type == 'float')
		{
			this.data = new Float32Array(this.data.buffer);
		}
		this.isCompressed = false;
	}

	toJSON()
	{
		var encoded = base64js.fromByteArray( new Uint8Array(this.data.buffer) );
		var obj = Object.assign({}, this, {data: encoded});
		return JSON.stringify(obj);
	}

	fromJSON(json)
	{
		var obj = json;
		if (typeof json === "string")
			obj = JSON.parse(json);
		
		this.data = obj.data || null;
		this.width = obj.width || 0;
		this.height = obj.height || 0;
		this.type = obj.type || 'uint8';
		this.format = obj.format || 'rgba';
		this.isCompressed = obj.isCompressed || false;

		if (this.data)
		{
			var decoded = base64js.toByteArray( this.data );
			if (decoded)
			{
				if (this.isCompressed)
					this.uncompress();

				if (this.type=='float')
					this.data = new Float32Array(this.data.buffer);
			}
			else
			{
				log('ERROR: could not decode base64 texture data');
			}
		}
	}
}


DataTexture.RGBA_8 = 1;
DataTexture.RGBA_F32 = 2;
DataTexture.RGB_8 = 3;
DataTexture.RGB_F32 = 4;
// DataTexture.RG_8 = 5;
// DataTexture.RG_F32 = 6;
DataTexture.UINT8 = 7;
DataTexture.FLOAT32 = 8;


export default DataTexture;