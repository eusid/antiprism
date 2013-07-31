var actions = {
		multiply: function(data) {
			return {r: data.numbers.reduce(function(p, c) {
				return p * c;
			}, 1)};
		},
		echo: function(data) {
			return data;
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

exports.handleMessage = function(message, storage, callbacks) {
	var result;
	try {
		var data = JSON.parse(message);
	} catch (e) {
		result = Error.JSON;
	}

	if (result !== Error.JSON) result = parseRequest(data);

	if (!isNaN(result)) {
		var error;
		switch (result) {
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
		result = {"error": error};
	}

	if (!result.response) {
		callbacks.response(result);
		return;
	}

	for (var callback in callbacks) {
		callbacks[callback](result[callback]);
	}
}