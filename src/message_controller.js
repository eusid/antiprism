var socket;
exports.init = function(ws) {
};

var E = {
	"INVALID_PARAMS":"parameters don't match the method's signature",
	"JSON":"received message not in JSON-format"
};
var jsonRPC = require("./jsonrpc.js");
myFuncs.multiply = function(params) {
	if(!(params instanceof Array) || params.length < 2)
		throw E.INVALID_PARAMS;
	return params[0]*params[1];
}
myFuncs.echo = function(params) {
	return params;
}

exports.handleMessage = function(message, callback) {
	try {
		try {
			var json = JSON.parse(message);
		} catch(e) {
			throw E.JSON;
		}
		callback(jsonRPC.call(myFuncs, json));
	} catch(e) {
		callback('message processing failed: '+e);
	}	
}
