var actions = {
	multiply: function(data) {
		return {r: data.numbers.reduce(function(p, c) {
			return p * c;
		}, 1)};
	},
	echo: function(params) {
		return params;
	}
};

exports.init = function(ws) {
};

var E = {
	"MISSING_ACTION": 0,
	"INVALID_ACTION": 1,
	"INVALID_PARAMS": 2,
	"JSON": 3
};
function parseRequest(data) {
	var action, actionName = data.action;
	if (!actionName) return E.MISSING_ACTION;

	action = actions[actionName];
	if (!action) return E.INVALID_ACTION;

	delete data.action;
	return action(data);
}

exports.handleMessage = function(message, callback) {
	var response;
	try {
		var data = JSON.parse(message);
		response = parseRequest(data);
	} catch (e) {
		response = E.JSON;
	}

	if (!isNaN(response)) {
		var error;
		switch (response) {
			case E.MISSING_ACTION:
				error = "Missing action parameter.";
				break;
			case E.INVALID_ACTION:
				error = "Action does not exist.";
				break;
			case E.INVALID_PARAMS:
				error = "Invalid action parameters.";
				break;
			case E.JSON:
				error = "JSON parse error.";
				break;
		}
		response = {"error": error};
	}

	callback(response);
}