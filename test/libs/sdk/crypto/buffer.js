try {
	var exports = window;
} catch(e) { }
(function(exports){
"use strict"

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
	Buffer.prototype.fromBase64 = function(sBase64) {
		var	sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
			nOutLen = nInLen * 3 + 1 >> 2;
		this.buf = new ArrayBuffer(nOutLen);
		var taBytes = new Uint8Array(this.buf);

		for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
			nMod4 = nInIdx & 3;
			nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
			if (nMod4 === 3 || nInLen - nInIdx === 1) {
				for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
					taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
		  		}
		  		nUint24 = 0;
			}
		}
		return this;
	};
	Buffer.prototype.toBase64 = function () {
		var nMod3, sB64Enc = "", aBytes = new Uint8Array(this.buf);

		for (var nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
			nMod3 = nIdx % 3;
			nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
			if (nMod3 === 2 || aBytes.length - nIdx === 1) {
				sB64Enc += String.fromCharCode(uint6ToB64(nUint24 >>> 18 & 63), uint6ToB64(nUint24 >>> 12 & 63), uint6ToB64(nUint24 >>> 6 & 63), uint6ToB64(nUint24 & 63));
				nUint24 = 0;
			}
		}

		return sB64Enc.replace(/A(?=A$|$)/g, "=");
	}

	if(typeof exports === 'object')
		exports.Buffer = Buffer;
	else
		return Buffer;
})(exports);