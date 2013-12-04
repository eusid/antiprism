var sendClient,
	actions = { // <debug>
		multiply: function(data) {
			if(data.numbers == undefined)
				return Error.INVALID_PARAMS;
			return {r: data.numbers.reduce(function(p, c) {
				return p * c;
			}, 1)};
		},
		echo: function(data) {
			return data;
		},
		storage: function(data, storage) {
			return {id:storage.id,name:storage.username};
		},
		sendToId: function(data, storage) {
			storage.sockets[data.id].ctx({msg:"it works!"});
			return {id:storage.id};
		}, // </debug>
		register: function(data, storage) {
			storage.redis.hexists("users."+data.username,"privkey",function(e,res) {
				if(res)
					sendClient({'registered':false});
				else {
					sendClient({'registered':true});
					storage.redis.hmset("users."+data.username,
						{pubkeyN: data.pubkey.n, pubkeyE: data.pubkey.e, privkey: data.privkey},
						function(err,res) {
							if(err) console.log(err);
						});
				}
			})
			return 0;
		},
		login: function(data, storage) {
			if(data.username === undefined)
				return Error.INVALID_PARAMS;
			storage.redis.hgetall("users."+data.username, function(err,reply) {
				if(!reply)
					return sendClient({error:"unknown user"});
				sendClient({redisreply:reply});
				storage.username = data.username;
				var randomString = require('crypto').randomBytes(32).toString();
				var rsa = new (require('node-bignumber').Key)();
				var pubkey = {n:reply.pubkeyN, e:reply.pubkeyE};
				rsa.setPublic(reply.pubkeyN, reply.pubkeyE);
				storage.validationKey = randomString;
				sendClient(
					{validationKey: rsa.encrypt(randomString), pubkey: {n:reply.pubkeyN, e:reply.pubkeyE}, privkey: reply.privkey}
				);
			});
			return 0;
		},
		auth: function(data, storage) {
			if(!data.validationKey)
				return Error.INVALID_PARAMS;
			var validationKey = new Buffer(data.validationKey, 'base64').toString('utf8');
			if(storage.validationKey == undefined || validationKey != storage.validationKey)
				return Error.INVALID_AUTH;
			storage.loggedIn = true;
			storage.redis.sadd("users."+storage.username+".sess", storage.id, function(err, reply) {
				if(err)
					console.log({error:err});
			});
			return {loggedIn:true};
		},
		contacts: function(data, storage) {
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hgetall("convs."+storage.username, function(err,reply) {
				sendClient({contacts:reply});
			});
			return 0;
		},
		pubkey: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			storage.redis.hmget("users."+data.user, "pubkeyN", "pubkeyE", function(err,reply) {
				sendClient({user:data.user,pubkey:{n:reply[0],e:reply[1]}});
			});
			return 0;
		},
		conversationKey: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			storage.redis.hget("convs."+storage.username,data.user, function(err,reply) {
				sendClient({user:data.user,convkey:reply});
			});
			return 0;
		},
		initConversation: function(data, storage) {
			storage.redis.exists("convs."+storage.username,
				function(err,reply) {
					if(err)
						return console.log({error:err});
					if(reply)
						sendClient({initiated:false,with:data.user});
				});
			storage.redis.hmset("convs."+storage.username,data.user,data.convkeys[0],
				function(err,reply) {
					if(err)
						return console.log({error:err});
				});
			storage.redis.hmset("convs."+data.user,storage.username,data.convkeys[1],
				function(err,reply) {
					if(err)
						return console.log({error:err});
				});
			return {initiated:true,with:data.user};
		},
		retrieveMessages: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			var start = parseInt(data.start), end = parseInt(data.end);
			if(isNaN(start) || isNaN(end))
				return Error.INVALID_PARAMS;
			if(data.user < storage.username) // lawl-sort
				var convid = data.user+'.'+storage.username;
			else
				var convid = storage.username+'.'+data.user;
			storage.redis.lrange("msgs."+convid, start, end, function(err, reply) {
				sendClient({msglist:reply.map(JSON.parse)});
			});
			return 0;
		},
		storeMessage: function(data, storage) {
			if(data.user === undefined || data.msg === undefined)
				return Error.INVALID_PARAMS;
			var storeMsg = {ts:new Date().getTime(), from:storage.username, msg:data.msg};
			if(data.user < storage.username) // lawl-sort
				var convid = data.user+'.'+storage.username;
			else
				var convid = storage.username+'.'+data.user;
			storage.redis.rpush("msgs."+convid, JSON.stringify(storeMsg), function(err, reply) {
				if(err)
					return console.log({error:err});
			});
			storage.redis.smembers("users."+data.user+".sess", function(err,reply) {
				if(err)
					return console.log({error:err});
				var ret = reply;
				storage.redis.smembers("users."+storage.username+".sess", function(err,reply) {
					if(err)
						return console.log({error:err});
					storeMsg.to = data.user;
					delete storeMsg.from;
					delete reply[reply.indexOf(storage.id)]; // don't push back to sending session
					ret.concat(reply);
					for(id in ret)
						if(storage.sockets[ret[id]] !== undefined) // not sure if redis and node are in sync
							storage.sockets[ret[id]].ctx(storeMsg);
				});
			});
			return {ts:storeMsg.ts};
		}
	},

	Error = {
		"JSON": -1,
		"MISSING_ACTION": 1,
		"INVALID_NAME": 2,
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
	sendClient = callbacks.response;
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
			case Error.UNKNOWN_USER:
				error = "Tried to access unknown user.";
				break;
		}
		result = {"error": error, code: result};
	}
	if(result)
		sendClient(result);
}