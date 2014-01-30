try {
	var exports = window;
} catch(e) { }
(function(exports){
"use strict"
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	function Buffer(input, format) {
		if(!input)
			return this.buf = new ArrayBuffer();
		this.format = format || typeof input;
		switch(this.format) {
			case 'base64':
				return this.fromBase64(input);
			case 'hex':
				return this.fromHex(input);
			default:
				return this.fromString(input.toString());
		}
	}

	function uint6ToB64 (nUint6) {
		return nUint6 < 26 ?
				nUint6 + 65
			: nUint6 < 52 ?
				nUint6 + 71
			: nUint6 < 62 ?
				nUint6 - 4
			: nUint6 === 62 ?
				43
			: nUint6 === 63 ?
				47
			:
				65;
	}

	function b64ToUint6 (nChr) {
		return nChr > 64 && nChr < 91 ?
				nChr - 65
			: nChr > 96 && nChr < 123 ?
				nChr - 71
			: nChr > 47 && nChr < 58 ?
				nChr + 4
			: nChr === 43 ?
				62
			: nChr === 47 ?
				63
			:
				0;
	}

	Buffer.prototype.fromString = function(str) {
		this.buf = new ArrayBuffer(str.length);
		var view = new Uint8Array(this.buf);
		for(var i = 0; i < str.length; i++)
			view[i] = str.charCodeAt(i);
		return this;
	}
	Buffer.prototype.toString = function(format) {
		switch(format) {
			case 'base64':
				return this.toBase64();
			case 'hex':
				return this.toHex();
			default:
				return String.fromCharCode.apply(this,new Uint8Array(this.buf));
		}
	}
	Buffer.prototype.fromHex = function (hex) {
		if(hex.length % 2)
			hex = '0'+hex;
		this.buf = new ArrayBuffer(hex.length / 2);
		var view = new Uint8Array(this.buf);

		for (var i = 0; i < view.length; i++)
			view[i] = parseInt(hex.substr(i*2, 2), 16);

		return this;
	};
	Buffer.prototype.toHex = function () {
		var view = new Uint8Array(this.buf),
			hex = "",
			chr;
		
		for (var i = 0; i < view.length; i++) {
			chr = view[i].toString(16);
			hex += (chr.length < 2) ? '0'+chr : chr;
		}
		return hex;
	};
	Buffer.prototype.fromBase64 = function(base64) {
		var bufferLength = base64.length * 0.75,
			len = base64.length, i, p = 0,
			encoded1, encoded2, encoded3, encoded4;

		if (base64[base64.length - 1] === "=") {
			bufferLength--;
			if (base64[base64.length - 2] === "=")
				bufferLength--;
		}

		this.buf = new ArrayBuffer(bufferLength);
		var bytes = new Uint8Array(this.buf);

		for (i = 0; i < len; i+=4) {
			encoded1 = chars.indexOf(base64[i]);
			encoded2 = chars.indexOf(base64[i+1]);
			encoded3 = chars.indexOf(base64[i+2]);
			encoded4 = chars.indexOf(base64[i+3]);

			bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
			bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
			bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
		}

		return this;
	}
	Buffer.prototype.toBase64 = function () {
		var bytes = new Uint8Array(this.buf),
			i, len = bytes.length, base64 = "";

		for (i = 0; i < len; i+=3) {
			base64 += chars[bytes[i] >> 2];
			base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
			base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
			base64 += chars[bytes[i + 2] & 63];
		}

		if ((len % 3) === 2) {
			base64 = base64.substring(0, base64.length - 1) + "=";
		} else if (len % 3 === 1) {
			base64 = base64.substring(0, base64.length - 2) + "==";
		}

		return base64;
	}

	if(typeof exports === 'object')
		exports.Buffer = Buffer;
	else
		return Buffer;
})(exports);