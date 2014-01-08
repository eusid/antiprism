/**
 * message_controller.js
 *
 * message controller for the node-server from Project Antiprism
 * -------------------------------------------------------------
 */
var helpers = {
		sendClient: undefined, // gets set on startup
		broadcast: function(storage, user, msg, callback) {
			storage.redis.smembers("sess."+user, function(err,reply) {
				if(err)
					return dbg("redis-Error: "+err);
				for(var id in reply) {
					if(storage.sockets[reply[id]] !== undefined) // not sure if redis and node are in sync
						storage.sockets[reply[id]].ctx(msg);
				}
			});
			if(callback) callback();
		}
	},
	actions = {
		register: function(data, storage) {
			storage.redis.hexists("users."+data.username,"privkey",function(e,res) {
				if(res)
					helpers.sendClient({'registered':false});
				else {
					helpers.sendClient({'registered':true});
					storage.redis.hmset("users."+data.username, {
							pubkeyN: data.pubkey.n,
							pubkeyE: data.pubkey.e,
							privkey: data.privkey,
							lastseen: new Date().getTime()
						},
						function(err,res) {
							if(err)
								dbg("redis-Error: "+err);
						});
				}
			})
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
					{validationKey: rsa.encrypt(randomString), pubkey: pubkey, privkey: reply.privkey}
				);
			});
		},
		changePass: function(data, storage) {
			if(data.privkey === undefined)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hset("users."+storage.username, "privkey", data.privkey, function(err,reply) {
				if(err)
					return dbg("redis-Error: "+err);
				helpers.sendClient({updated:true});
			});
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
					return dbg("redis-Error: "+err);
				storage.redis.scard("sess."+storage.username, function(err, reply) {
					if(err)
						return dbg("redis-Error: "+err);
					if(parseInt(reply) == 1)
						storage.redis.hgetall("convs."+storage.username, function(err, contacts) {
							for (var user in contacts)
								helpers.broadcast(storage, user, {online:true, user:storage.username});
						});
				});
			});
			delete storage.validationKey;
			return {loggedIn:true};
		},
		setStatus: function(data, storage) {
			if(!data.status && data.status !== "")
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hmset("users."+storage.username,"status",data.status, function(err,reply) {
				if(err)
					dbg("redis-Error: "+err);
				helpers.sendClient({status:true});
			});
		},
		getStatus: function(data, storage) {
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hget("users."+storage.username, "status", function(err, reply) {
				helpers.sendClient({status:reply});
			});
		},
		removeContact: function(data, storage) {
			if(!data.user)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hdel("convs."+storage.username, data.user, function(err, reply) {
				helpers.sendClient({removed:!!reply});
			});
		},
		contacts: function(data, storage) {
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;

			storage.redis.multi()
				.hgetall("convs."+storage.username)
				.hgetall("reqs."+storage.username)
				.exec(function(err,replies) {
					if(!replies[0] && !replies[1])
						return helpers.sendClient({contacts:{}});
					var contacts = replies[0],
						requests = replies[1];
					if(!contacts)
						return helpers.sendClient({contacts:{}, requests:requests||[]});
					var ret = {}, users = Object.keys(contacts), usersIndex = users.length;
					for(var i in users) {
						storage.redis.multi()
							.scard("sess."+users[i])
							.hmget("users."+users[i],"status","lastseen")
							.hexists("convs."+users[i],storage.username)
							.hexists("convs."+storage.username,users[i])
							.exec(function(err,replies) {
								var friends = !!(replies[2]&&replies[3]);
								ret[users[i-usersIndex+1]] = {
									key: contacts[users[i-usersIndex+1]],
									online: !!(replies[0]&&friends),
									status: replies[1][0], // maybe priv8?
									lastseen: friends ? replies[1][1] : 0,
									confirmed: friends ? undefined : false 
								};
								usersIndex--;
								if(!usersIndex)
									helpers.sendClient({contacts:ret,requests:requests||[]});
							});
					}
				});
		},
		pubkey: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			storage.redis.hmget("users."+data.user, "pubkeyN", "pubkeyE", function(err,reply) {
				if(reply[0] && reply[1])
					helpers.sendClient({user:data.user,pubkey:{n:reply[0],e:reply[1]}});
				else
					helpers.sendClient({error:Error.UNKNOWN_USER});
			});
		},
		conversationKey: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.hget("convs."+storage.username,data.user, function(err,reply) {
				helpers.sendClient({user:data.user,convkey:reply});
			});
		},
		initConversation: function(data, storage) {
			if(data.user === undefined || !data.convkeys)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.multi()
				.hsetnx("convs."+storage.username,data.user,data.convkeys[0])
				.hexists("reqs."+storage.username, data.user)
				.exec(function(err,replies) {
					if(err)
						return dbg("redis-Error: "+err);
					if(!replies[0]||replies[1])
						return helpers.sendClient({initiated:false,with:data.user});
					storage.redis.hsetnx("reqs."+data.user,storage.username,data.convkeys[1],function(err,reply) {
						if(err)
							return dbg("redis-Error: "+err);
						if(!reply)
							return helpers.sendClient({initiated:false,with:data.user});
						helpers.sendClient({initiated:true,with:data.user});
						helpers.broadcast(storage,data.user,{user:storage.username,convkey:data.convkeys[1],added:true});
					});
				});
		},
		confirm: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			storage.redis.multi()
				.hexists("convs."+storage.username,data.user)
				.hget("reqs."+storage.username, data.user)
				.hdel("reqs."+storage.username, data.user)
				.exec(function(err,replies) {
					if(err)
						return dbg("redis-Error: "+err);
					if(replies[0] || !replies[1])
						return helpers.sendClient({ack:false});
					storage.redis.hset("convs."+storage.username, data.user, replies[1], function(err,reply) {
						helpers.broadcast(storage, data.user, {online:true, user:storage.username});
						helpers.sendClient({ack:true});
					});
				});
		},
		countMessages: function(data, storage) {
			if(data.user === undefined)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			if(data.user < storage.username) // lawl-sort
				var convid = data.user+'.'+storage.username;
			else
				var convid = storage.username+'.'+data.user;
			storage.redis.llen("msgs."+convid, function(err, reply) {
				if(err)
					return dbg("redis-Error: "+err);
				helpers.sendClient({msgcount:reply, user:data.user});
			});
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
		},
		storeMessage: function(data, storage) {
			if(data.user === undefined || data.msg === undefined)
				return Error.INVALID_PARAMS;
			if(!storage.loggedIn)
				return Error.INVALID_AUTH;
			var storeMsg = {ts:new Date().getTime(), from:storage.username, msg:data.msg};
			if(data.user < storage.username) // lawl-sort
				var convid = data.user+'.'+storage.username;
			else
				var convid = storage.username+'.'+data.user;
			storage.redis.rpush("msgs."+convid, JSON.stringify(storeMsg), function(err, reply) {
				if(err)
					return dbg("redis-Error: "+err);
			});
			helpers.broadcast(storage, data.user, storeMsg);
			storage.redis.smembers("sess."+storage.username, function(err,reply) {
				if(err)
					return dbg("redis-Error: "+err);
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

	Error = {
		"JSON": -1,
		"MISSING_ACTION": 1,
		"INVALID_NAME": 2,
		"INVALID_ACTION": 3,
		"INVALID_PARAMS": 4,
		"UNKNOWN_USER": 5,
		"INVALID_AUTH": 6,
		"UNKNOWN_PUBKEY": 7,
		"NOT_ALLOWED": 8
	},

	parseRequest = function(data, storage) {
		var action, actionName = data.action;
		if (!actionName) return Error.MISSING_ACTION;

		action = actions[actionName];
		if (!action || action.constructor.prototype[actionName]) return Error.INVALID_ACTION;

		delete data.action;
		return action(data, storage);
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
	if (result !== Error.JSON) 
		result = parseRequest(data, storage);
	if(!isNaN(result))
		result = {error:result};
	if(result)
		helpers.sendClient(result);
};
