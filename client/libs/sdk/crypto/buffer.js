define(function() {
"use strict"
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
		hexchars = "0123456789abcdef";

	function Buffer(input, format) {
		if(!input)
			return this.buf = [];
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

	Buffer.prototype.fromString = function(str) {
		this.buf = new Array(str.length);
		for(var i = 0; i < str.length; i++)
			this.buf[i] = str.charCodeAt(i);
		return this;
	}
	Buffer.prototype.toString = function(format) {
		switch(format) {
			case 'base64':
				return this.toBase64();
			case 'hex':
				return this.toHex();
			default:
				return String.fromCharCode.apply(this,this.buf);
		}
	}
	Buffer.prototype.fromHex = function (hex) {
		if(hex.length % 2)
			hex = '0'+hex;
		this.buf = new Array(hex.length>>1);
		for (var i = 0; i < hex.length; i+=2)
			this.buf[i>>1] = ((hex[i]>'9'?((hex[i].charCodeAt(0)^96)+9):hex[i])<<4)
							|((hex[i+1]>'9'?((hex[i+1].charCodeAt(0)^96)+9):hex[i+1])<<0);

		return this;
	};
	Buffer.prototype.toHex = function () {
		var hex = "";
		for (var i = 0; i < this.buf.length; i++)
			hex += hexchars[this.buf[i]>>4]+hexchars[this.buf[i]%16];
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

		this.buf = new Uint8Array(bufferLength);

		for (i = 0; i < len; i+=4) {
			encoded1 = chars.indexOf(base64[i]);
			encoded2 = chars.indexOf(base64[i+1]);
			encoded3 = chars.indexOf(base64[i+2]);
			encoded4 = chars.indexOf(base64[i+3]);
 
 			this.buf[p++] = (encoded1 << 2) | (encoded2 >> 4);
			this.buf[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
			this.buf[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
		}
		return this;
	}
	Buffer.prototype.toBase64 = function () {
		var i, len = this.buf.length, base64 = "";
			
		for (i = 0; i < len; i+=3) {
			base64 += chars[this.buf[i] >> 2];
			base64 += chars[((this.buf[i] & 3) << 4) | (this.buf[i + 1] >> 4)];
			base64 += chars[((this.buf[i + 1] & 15) << 2) | (this.buf[i + 2] >> 6)];
			base64 += chars[this.buf[i + 2] & 63];
		}

		if ((len % 3) === 2) {
			base64 = base64.substring(0, base64.length - 1) + "=";
		} else if (len % 3 === 1) {
			base64 = base64.substring(0, base64.length - 2) + "==";
		}

		return base64;
	}

	return Buffer;
});