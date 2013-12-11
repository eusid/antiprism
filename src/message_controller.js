var helpers = {
		sendClient: undefined, // gets set on startup
		broadcast: function(storage, user, msg, callback) {
			storage.redis.smembers("sess."+user, function(err,reply) {
				if(err)
					return console.log({error:err});
				for(var id in reply) {
					if(storage.sockets[reply[id]] !== undefined) // not sure if redis and node are in sync
						storage.sockets[reply[id]].ctx(msg);
				}
			});
			if(callback) callback();
		},
		registerServer: function(storage, host, callback) {
			var hostinfo = host.split(":",2),
				server = hostinfo[0],
				port = hostinfo[1] || 80;
			console.log("got "+server+" and "+port);
			if(!(require("net")).isIPv4(server))
				return (require("dns")).lookup(server, 4, function(err,ip) {
					console.log("looked up "+server+", got "+err||ip);
					if(err == null)
						helpers.registerServer(storage, [ip,port].join(":"), callback);
				});
			var ws = new (require("ws"))("ws://"+host);
			ws.outqueue = [];
			ws
				.on("open",function() {
					ws.send("SYN");
					ws.timeout = setInterval(function() {
						ws.send("PING");
					}, 25000);
					console.log("said hi to "+host);
					console.log("working queue now");
					while(ws.outqueue.length)
						ws.sendObject(ws.outqueue.shift());
				})
				.on("message", function(msg) {
					console.log("got msg from "+host);
					console.log(msg);
					if(msg == "ACK") {
						storage.remotes[host] = {socket:ws, callbacks:{}};
						return callback?callback(0):0;
					}
					if(msg == "PONG") {
						//TODO: something!?
						return;
					}
					try {
						var data = JSON.parse(msg);
						if(data.action)
							if(Object.keys(RemoteAllowed).indexOf(data.action) == -1)
								throw Error.INVALID_ACTION;
							else {
								console.log("got something to parse:");
								console.log(msg);
								helpers.parseRequest(msg,storage); // TODO: react to events
							}
						else if(data.fromRemote)
							for(var event in RemoteAllowed)
								if(Object.keys(data).indexOf(RemoteAllowed[event]) !== -1) {
									console.log("callbacks for "+data.fromRemote)
									console.log(storage.remotes[host].callbacks[data.fromRemote]);
									console.log("calling "+data.fromRemote+"'s callback for event: "+event);
									storage.remotes[host].callbacks[data.fromRemote][event](data, storage);
								}

					} catch (e) {
						console.log("error: "+e);
					}				
				})
				.on("error", function(err) {
					if(callback)
						callback(err);
				})
				.sendObject = function(msg) {
					if(ws.readyState != 1)
						ws.outqueue.push(msg);
					else
						ws.send(JSON.stringify(msg));
				};
		},
		redirect: function(data, storage, callback) {
			var parts = data.user.split("@"),
				user = parts[0],
				host = parts[1];
			if(!storage.remotes[host])
				return helpers.registerServer(storage, host, function(err) {
					if(!err)
						helpers.redirect(data,storage,callback);
				});
			var actions = Object.keys(RemoteAllowed),
				event = actions[actions.indexOf(data.action)];
			if(event === undefined)
				return console.log("currently unsupported action: "+data.action);
			data.fromRemote = storage.username;
			if(!storage.remotes[host].callbacks[storage.username])
				storage.remotes[host].callbacks[storage.username] = {};
			storage.remotes[host].callbacks[storage.username][event] = callback;
			console.log("sending to "+[user,host].join("@"));
			console.log(data);
			storage.remotes[host].socket.sendObject(data);			
		},
		parseRequest: function(data, storage) {
			var action, actionName = data.action;
			if (!actionName) return Error.MISSING_ACTION;

			action = actions[actionName];
			if (!action || action.constructor.prototype[actionName]) return Error.INVALID_ACTION;

			return action(data, storage);
		}
	},
	actions = {
		register: function(data, storage) {
			if(data.username === undefined || data.username.indexOf("@") !== -1)
				return Error.INVALID_NAME;
			storage.redis.hexists("users."+data.username,"privkey",function(e,res) {
				if(res)
					helpers.sendClient({'registered':false});
				else {
					helpers.sendClient({'registered':true});
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
					return helpers.sendClient({error:"unknown user"});
				storage.username = data.username;
				var randomString = require('crypto').randomBytes(32).toString();
				var rsa = new (require('node-bignumber').Key)();
				var pubkey = {n:reply.pubkeyN, e:reply.pubkeyE};
				rsa.setPublic(reply.pubkeyN, reply.pubkeyE);
				storage.validationKey = randomString;
				helpers.sendClient(
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
			storage.redis.sadd("sess."+storage.username, storage.id, function(err, reply) {
				if(err)
					console.log({error:err});
				storage.redis.scard("sess."+storage.username, function(err, reply) {
					if(err)
						return console.log({error:err});
					if(parseInt(reply) == 1)
						storage.redis.hgetall("convs."+storage.username, function(err, contacts) {
							for (user in contacts)
								helpers.broadcast(storage, user, {online:true, user:storage.username});
						});
				});
			});
			return {loggedIn:true};
		},
		contacts: function(data, storage) {
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hgetall("convs."+storage.username, function(err,contacts) {
				if(!contacts)
					return helpers.sendClient({contacts:[]});
				var ret = {}, users = Object.keys(contacts), usersIndex = users.length;
				for(var i in users) {
					storage.redis.scard("sess."+users[i], function(err,reply) {
						usersIndex--;
						ret[users[usersIndex]] = {key:contacts[users[usersIndex]],online:!!parseInt(reply)};
						if(!usersIndex)
							helpers.sendClient({contacts:ret});
					});
				}
			});
			return 0;
		},
		pubkey: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			data.user = storage.isServer ? data.user.split("@")[0] : data.user;
			if(data.user.indexOf("@") != -1)
				helpers.redirect(data, storage, function(msg) {
					msg.user = data.user;
					helpers.sendClient(msg);
				});
			else
				storage.redis.hmget("users."+data.user, "pubkeyN", "pubkeyE", function(err,reply) {
					helpers.sendClient({user:data.user,pubkey:{n:reply[0],e:reply[1]},fromRemote:data.fromRemote});				
				});
			return 0;
		},
		conversationKey: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hget("convs."+storage.username,data.user, function(err,reply) {
				helpers.sendClient({user:data.user,convkey:reply});
			});
			return 0;
		},
		initConversation: function(data, storage) {
			if(data.user === undefined || !data.convkeys)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hexists("convs."+storage.username, data.user, function(err,reply) {
				if(err)
					return console.log({error:err});
				if(reply)
					return helpers.sendClient({initiated:false,with:data.user});
				if(storage.isServer) {
					delete data.convkeys[0];
					data.user = data.user.split("@")[0];
					storage.username = [data.fromRemote,storage.hostname].join("@");
				}
				var isLocal = data.user.indexOf("@") == -1;
				if(!isLocal)
					helpers.redirect(data, storage, function(msg) {
						msg.with = data.user;
						helpers.sendClient(msg);
					});
				helpers.sendClient({initiated:true,with:data.user});
				if(data.convkeys[1] && isLocal)
					storage.redis.hmset("convs."+data.user,storage.username,data.convkeys[1], function(err,reply) {
						if(err)
							return console.log({error:err});
						helpers.broadcast(storage,data.user,{user:storage.username,convkey:data.convkeys[1],added:true});
					});
				if(data.convkeys[0])
					storage.redis.hmset("convs."+storage.username,data.user,data.convkeys[0], function(err,reply) {
						if(err)
							return console.log({error:err});
					});
			});
			return 0;
		},
		countMessages: function(data, storage) {
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			if(data.user < storage.username) // lawl-sort
				var convid = data.user+'.'+storage.username;
			else
				var convid = storage.username+'.'+data.user;
			storage.redis.llen("msgs."+convid, function(err, reply) {
				if(err)
					return console.log({error:err});
				helpers.sendClient({msgcount:reply, user:data.user});
			});
			return 0;
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
				helpers.sendClient({msglist:reply.map(JSON.parse)});
			});
			return 0;
		},
		storeMessage: function(data, storage) {
			if(data.user === undefined || data.msg === undefined)
				return Error.INVALID_PARAMS;
			var storeMsg = {ts:new Date().getTime(), from:storage.username, msg:data.msg};
			console.log("storeMessage called! Data:");
			console.log(data);
			console.log("Callmode: "+(storage.isServer?"Server2Server":"Standard"));
			if(storage.isServer) {
				storeMsg.from = [data.fromRemote,storage.hostname].join("@");
				data.user = data.user.split("@")[0];
				console.log("got msg:");
				console.log(data);
				console.log("storeMsg:");
				console.log(storeMsg);
			}
			var other = data.user;
			var isLocal = data.user.indexOf("@") == -1;
			if(data.fromRemote) {
				storeMsg.from = [data.fromRemote,storage.hostname].join("@");
				helpers.broadcast(storage, data.user.split("@")[0], storeMsg);
			}
			if(!isLocal) {
				helpers.redirect(data,storage, function(msg) {
					console.log("callback called with msg:");
					console.log(msg);
					msg.from = data.user;
					helpers.broadcast(storage, data.fromRemote, msg);
				});
				other = data.user.split("@")[0];
			}
			else
				helpers.broadcast(storage, data.user, storeMsg);
			if(other < storeMsg.from) // lawl-sort
				var convid = other+'.'+storeMsg.from;
			else
				var convid = storeMsg.from+'.'+other;
			storage.redis.rpush("msgs."+convid, JSON.stringify(storeMsg), function(err, reply) {
				if(err)
					return console.log({error:err});
			});
			storage.redis.smembers("sess."+storage.username, function(err,reply) {
				if(err)
					return console.log({error:err});
				storeMsg.to = data.user;
				delete storeMsg.from;
				for(var id in reply)
					if(storage.sockets[reply[id]] !== undefined // not sure if redis and node are in sync
						&& reply[id] != storage.id) // do not push back to sending user
						storage.sockets[reply[id]].ctx(storeMsg);
			});
			return {ts:storeMsg.ts, sent:true};
		}
	},
	RemoteAllowed = { 
		pubkey: "pubkey",
		initConversation: "initiated",
		storeMessage: "msg"
	},
	Error = {
		"JSON": -1,
		"MISSING_ACTION": 1,
		"INVALID_NAME": 2,
		"INVALID_ACTION": 3,
		"INVALID_PARAMS": 4,
		"UNKNOWN_USER": 5,
		"INVALID_AUTH": 6,
	};

exports.helpers = helpers;
exports.handleMessage = function(message, storage, callbacks) {
	helpers.sendClient = callbacks.response;
	var result;
	try {
		var data = JSON.parse(message);
	} catch (e) {
		result = Error.JSON;
	}

	if (result !== Error.JSON) result = helpers.parseRequest(data, storage);

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
		if(error)
			result = {"error": error, code: result};
	}
	if(result)
		helpers.sendClient(result);
}