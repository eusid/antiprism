var jsonRPC = require('/tmp/jsonrpc.js');

var E = {
	"INVALID_PARAMS":"parameters don't match the method's signature",
};

function multiply(params) {
	if(!(params instanceof Array) || params.length < 2)
		throw E.INVALID_PARAMS;
	return params[0]*params[1];
}

function add(params) {
	if(!(params instanceof Array) || params.length < 2)
		throw E.INVALID_PARAMS;
	return params[0]+params[1];
}
	

var json = {"action":"a","params":[13]};
var myFuncs = {"echo":function(params) { return params }, "m": multiply, "a":add};
try {
	var result = jsonRPC.call(myFuncs, json);
	console.log(result);
} catch (e) {
	console.log('RPC failed: '+e);
}
