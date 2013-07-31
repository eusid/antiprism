var actions = {
		multiply: function(data) {
			return {r: data.numbers.reduce(function(p, c) {
				return p * c;
			}, 1)};
		},
		echo: function(params) {
			return params;
		}
	},

	Error = {
		"JSON": 1,
		"MISSING_ACTION": 2,
		"INVALID_ACTION": 3,
		"INVALID_PARAMS": 4
	},

	parseRequest = function(data) {
		var action, actionName = data.action;
		if (!actionName) return Error.MISSING_ACTION;

		action = actions[actionName];
		if (!action || action.constructor.prototype[actionName]) return Error.INVALID_ACTION;

		delete data.action;
		return action(data);
	};

exports.handleMessage = function(message, callback) {
	var response;
	try {
		var data = JSON.parse(message);
	} catch (e) {
		response = Error.JSON;
	}

	if (response !== Error.JSON) response = parseRequest(data);

	if (!isNaN(response)) {
		var error;
		switch (response) {
			case Error.MISSING_ACTION:
				error = "Missing action parameter.";
				break;
			case Error.INVALID_ACTION:
				error = "Action does not exist.";
				break;
			case Error.INVALID_PARAMS:
				error = "Invalid action parameters.";
				break;
			case Error.JSON:
				error = "JSON parse error.";
				break;
		}
		response = {"error": error};
	}

	callback(response);
}