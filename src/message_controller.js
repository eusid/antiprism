var actions = {
		multiply: function(data) {
			return {r: data.numbers.reduce(function(p, c) {
				return p * c;
			}, 1)};
		},
		echo: function(data) {
			return data;
		},
		login: function(data, storage) {
			var randomString = require('crypto').randomBytes(32).toString();
			// todo: get pubkey and encryptedPrivKey from db, hardcoded for demo
			if(data.user != "root")
				return Error.UNKNOWN_USER;
			var PUBKEY = {"n":"9ea6cda1eeaf2e41035784601b6535f7793959e204f4fb6eb855b26119ab30570c005d33e2ebfb8e0cbc80f3f9f207ab47b5f3805f28e4f9f2e6b5d3ba4c7685577a3fac450b32929b07a7aac5d852a9f7d99cfb68d6bcde191aedf8b31a95472f7d5a8937ebba77c16a2ca2c3bfb8b73bdeaae29b61e94e1c848815f73eb709721442ab420f6fe33cf5d91fb9b65fad3e09cda64aaec340f14a84e0f6447f83866cff58816a387be6e0e8bc6ef940f22d9aa0a3b78eea068090af5f5a5ae8bfb9204ccb965c1a9b45f0d5e2f678f8fd7e9e06a09d62fe4cc03fc2fae8e37f2907e09d368227f974a2a985eb8a27e8a4106082ecfa2b0e1a80e537fe5b0549e1","e":"10001"}
			var PRIVKEY = "zCns/hP3r15EzV38jTsA97jcANleM+IYDa1Mfp1Zsi+cwrSaAKI6lKpoXOl4xM6CYUCcBV0Wi0AkqVAbA13t1Ay3OeO+yYIEl1mqUHfKxg9bS589yE0N071FMGWxUBLOKrgRD7MBhMgXG0aCvTvaw32JazwvBxpiWN5W8yLViLovPMd0TBMfcn6IO/e2w+oM+QwsFAzK6KHSStXyTRqfc/J+bmCbyr99XRElWX/OBjycNIL87HNuW8GlCzSuPquBm2SX4m3a0fji7Cj43NIMY4hoMAiQX4qtiyrI137x4v/T2BKn8Vs1aqCabwkaUrJRbWB8P2+4UEoQSXwwnSZjqe/Hj814g9tX2D4/3knMtnFMN3Z7ObZH1NPWBBdC9Gu3GH8IjinhdjURW6+q1PLr02IZrBax0LwaMGC0CqA9G0wscflKAxkScgKq9I0NshUl2H58qP6r0r8xkeHp+52SVBLV3NyebP0JpDpe5VMs4i6L/BOPu0+agC71hS5zlcBpKhREXmE/niod/lvOPQMMq+9y8V5i8gNFq81DvuU7OS6HFexLo8S062Evojbh71H2TGFjY8vo1n5TKizQP+zL2JmQWuidAQeigLDVCwj3d40N+0mhMEqPo6reqbycSAU9Qkb6/RyAj9GAmewYSyVTtuYEuo8GGWY/UExIzEfsAShf7uvXVp1GWfTHFzJ1X0kTff178xhIzizVl6hAjWKu7A==";
			var rsa = new (require('node-bignumber').Key)();
			// end of hardcoded shit
			rsa.setPublic(PUBKEY.n, PUBKEY.e);
			storage.validationKey = randomString;
			return {validationKey: rsa.encrypt(randomString), pubkey: PUBKEY, privkey: PRIVKEY};
		},
		auth: function(data, storage) {
			if(!data.validationKey)
				return Error.INVALID_PARAMS;
			var validationKey = new Buffer(data.validationKey, 'base64').toString('utf8');
			if(storage.validationKey == undefined || validationKey != storage.validationKey)
				return Error.INVALID_AUTH;
			storage.loggedIn = true;
			return {};
		}
	},

	Error = {
		"JSON": 1,
		"MISSING_ACTION": 2,
		"INVALID_ACTION": 3,
		"INVALID_PARAMS": 4,
		"UNKNOWN_USER": 5,
		"INVALID_AUTH": 6,
	},

	parseRequest = function(data, storage) {
		var action, actionName = data.action;
		if (!actionName) return Error.MISSING_ACTION;

		action = actions[actionName];
		if (!action || action.constructor.prototype[actionName]) return Error.INVALID_ACTION;

		delete data.action;
		return action(data, storage);
	};

exports.handleMessage = function(message, storage, callbacks) {
	var result;
	try {
		var data = JSON.parse(message);
	} catch (e) {
		result = Error.JSON;
	}

	if (result !== Error.JSON) result = parseRequest(data, storage);

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
			case Error.INVALID_AUTH:
				error = "Invalid authentication-key";
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