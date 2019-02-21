
import {LoaderUtils} from '../LoaderUtils';

function BinaryReader( buffer, littleEndian ) {

	this.dv = new DataView( buffer );
	this.offset = 0;
	this.littleEndian = ( littleEndian !== undefined ) ? littleEndian : true;

}

Object.assign( BinaryReader.prototype, {

	getOffset: function () {

		return this.offset;

	},

	size: function () {

		return this.dv.buffer.byteLength;

	},

	skip: function ( length ) {

		this.offset += length;

	},

	// seems like true/false representation depends on exporter.
	// true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
	// then sees LSB.
	getBoolean: function () {

		return ( this.getUint8() & 1 ) === 1;

	},

	getBooleanArray: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getBoolean() );

		}

		return a;

	},

	getInt8: function () {

		var value = this.dv.getInt8( this.offset );
		this.offset += 1;
		return value;

	},

	getInt8Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getInt8() );

		}

		return a;

	},

	getUint8: function () {

		var value = this.dv.getUint8( this.offset );
		this.offset += 1;
		return value;

	},

	getUint8Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getUint8() );

		}

		return a;

	},

	getInt16: function () {

		var value = this.dv.getInt16( this.offset, this.littleEndian );
		this.offset += 2;
		return value;

	},

	getInt16Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getInt16() );

		}

		return a;

	},

	getUint16: function () {

		var value = this.dv.getUint16( this.offset, this.littleEndian );
		this.offset += 2;
		return value;

	},

	getUint16Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getUint16() );

		}

		return a;

	},

	getInt32: function () {

		var value = this.dv.getInt32( this.offset, this.littleEndian );
		this.offset += 4;
		return value;

	},

	getInt32Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getInt32() );

		}

		return a;

	},

	getUint32: function () {

		var value = this.dv.getUint32( this.offset, this.littleEndian );
		this.offset += 4;
		return value;

	},

	getUint32Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getUint32() );

		}

		return a;

	},

	// JavaScript doesn't support 64-bit integer so calculate this here
	// 1 << 32 will return 1 so using multiply operation instead here.
	// There's a possibility that this method returns wrong value if the value
	// is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
	// TODO: safely handle 64-bit integer
	getInt64: function () {

		var low, high;

		if ( this.littleEndian ) {

			low = this.getUint32();
			high = this.getUint32();

		} else {

			high = this.getUint32();
			low = this.getUint32();

		}

		// calculate negative value
		if ( high & 0x80000000 ) {

			high = ~ high & 0xFFFFFFFF;
			low = ~ low & 0xFFFFFFFF;

			if ( low === 0xFFFFFFFF ) high = ( high + 1 ) & 0xFFFFFFFF;

			low = ( low + 1 ) & 0xFFFFFFFF;

			return - ( high * 0x100000000 + low );

		}

		return high * 0x100000000 + low;

	},

	getInt64Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getInt64() );

		}

		return a;

	},

	// Note: see getInt64() comment
	getUint64: function () {

		var low, high;

		if ( this.littleEndian ) {

			low = this.getUint32();
			high = this.getUint32();

		} else {

			high = this.getUint32();
			low = this.getUint32();

		}

		return high * 0x100000000 + low;

	},

	getUint64Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getUint64() );

		}

		return a;

	},

	getFloat32: function () {

		var value = this.dv.getFloat32( this.offset, this.littleEndian );
		this.offset += 4;
		return value;

	},

	getFloat32Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getFloat32() );

		}

		return a;

	},

	getFloat64: function () {

		var value = this.dv.getFloat64( this.offset, this.littleEndian );
		this.offset += 8;
		return value;

	},

	getFloat64Array: function ( size ) {

		var a = [];

		for ( var i = 0; i < size; i ++ ) {

			a.push( this.getFloat64() );

		}

		return a;

	},

	getArrayBuffer: function ( size ) {

		var value = this.dv.buffer.slice( this.offset, this.offset + size );
		this.offset += size;
		return value;

	},

	getChar: function () {

		return String.fromCharCode( this.getUint8() );

	},

	getString: function ( size ) {
		var data = this.getArrayBuffer ( size )
		var s = LoaderUtils.decodeText( data );
		return s;
	}
} );


export default BinaryReader;