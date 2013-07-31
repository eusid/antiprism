var jsonRPC = module.exports;
var E = {
	"INVALID_METHOD":"the methodname supplied is unknown",
	"FORMAT":"object is not in jsonRPC-format"
};

jsonRPC.call = function jsonRPC(funcs, json) {
	if(!json.action)
		throw E.FORMAT;
	if(funcs[json.action])
		return funcs[json.action](json.params);
	else
		throw E.INVALID_METHOD;
};
