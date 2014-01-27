/**
 * message_controller.js
 *
 * message controller for the node-server from Project Antiprism
 * -------------------------------------------------------------
 */
var helpers = {
		broadcast: function(storage, user, msg, callback) {
			storage.redis.smembers("sess."+user, function(err,reply) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				for(var id in reply) {
					if(storage.sockets[reply[id]] !== undefined) // not sure if redis and node are in sync
						storage.sockets[reply[id]].send(msg);
				}
			});
			if(callback) callback();
		}
	},
	actions = {
		register: function(ctx, username, pubkey, privkey) {
			ctx.storage.redis.hexists("users."+username,"privkey",function(e,res) {
				if(res)
					ctx.sendClient({'registered':false});
				else {
					ctx.sendClient({'registered':true});
					ctx.storage.redis.hmset("users."+username, {
							pubkeyN: pubkey.n,
							pubkeyE: pubkey.e,
							privkey: privkey,
							lastseen: new Date().getTime()
						},
						function(err,res) {
							if(err)
								helpers.dbg("redis-Error: "+err);
						});
				}
			})
		},
		login: function(ctx, username) {
			if(username === undefined)
				return Error.INVALID_PARAMS;
			ctx.storage.redis.hgetall("users."+username, function(err,reply) {
				if(!reply)
					return ctx.sendClient({error:"unknown user"});
				ctx.storage.username = username;
				var randomString = require('crypto').randomBytes(32).toString();
				var rsa = new (require('node-bignumber').Key)();
				var pubkey = {n:reply.pubkeyN, e:reply.pubkeyE};
				rsa.setPublic(reply.pubkeyN, reply.pubkeyE);
				ctx.storage.validationKey = randomString;
				ctx.sendClient(
					{validationKey: rsa.encrypt(randomString), pubkey: pubkey, privkey: reply.privkey}
				);
			});
		},
		changePass: function(ctx, privkey) {
			if(privkey === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.hset("users."+ctx.storage.username, "privkey", privkey, function(err,reply) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				ctx.sendClient({updated:true});
			});
		},
		auth: function(ctx, validationKey) {
			if(!validationKey)
				return Error.INVALID_PARAMS;
			var validationKey = new Buffer(validationKey, 'base64').toString('utf8');
			if(ctx.storage.validationKey == undefined || validationKey != ctx.storage.validationKey)
				return Error.INVALID_AUTH;
			ctx.storage.loggedIn = true;
			ctx.storage.redis.sadd("sess."+ctx.storage.username, ctx.storage.id, function(err, reply) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				ctx.storage.redis.scard("sess."+ctx.storage.username, function(err, reply) {
					if(err)
						return helpers.dbg("redis-Error: "+err);
					if(parseInt(reply) == 1)
						ctx.storage.redis.hgetall("convs."+ctx.storage.username, function(err, contacts) {
							for (var user in contacts)
								helpers.broadcast(ctx.storage, user, {online:true, user:ctx.storage.username});
						});
				});
			});
			delete ctx.storage.validationKey;
			ctx.sendClient({loggedIn:true});
		},
		setStatus: function(ctx, status) {
			if(!status && status !== "")
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.hmset("users."+ctx.storage.username,"status",status, function(err,reply) {
				if(err)
					helpers.dbg("redis-Error: "+err);
				ctx.sendClient({status:true});
			});
		},
		getStatus: function(ctx) {
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.hget("users."+ctx.storage.username, "status", function(err, reply) {
				ctx.sendClient({status:reply});
			});
		},
		removeContact: function(ctx, user) {
			if(!user)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.hdel("convs."+ctx.storage.username, user, function(err, reply) {
				ctx.sendClient({removed:!!reply});
			});
		},
		contacts: function(ctx) {
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.multi()
				.hgetall("convs."+ctx.storage.username)
				.hgetall("reqs."+ctx.storage.username)
				.exec(function(err,replies) {
					var contacts = replies[0],
						requests = replies[1];
					if(!contacts)
						return ctx.sendClient({contacts:{}, requests:requests||[]});
					var	multi = ctx.storage.redis.multi(),
						users = Object.keys(contacts),
						opCount;
					for(var i in users) {
						multi
							.scard("sess."+users[i])
							.hmget("users."+users[i],"status","lastseen")
							.hexists("convs."+users[i],ctx.storage.username)
							.hexists("convs."+ctx.storage.username,users[i]);
						if(opCount === undefined)
							opCount = multi.queue.length - 1;
					}
					multi.exec(function(err,replies) {
						var ret = {};
						for(var i = 0; i < users.length; i++) {
							var redisIndex = i*opCount,
								reply = [];
							for(var j = 0; j < opCount; j++)
								reply.push(replies[redisIndex+j]);
							var friends = !!(reply[2]&&reply[3]);
							ret[users[i]] = {
								key: contacts[users[i]],
								online: !!(reply[0]&&friends),
								status: reply[1][0], // maybe priv8?
								lastseen: friends ? reply[1][1] : 0,
								confirmed: friends ? undefined : false 
							};
						}
						helpers.dbg("replying to contacts-request");
						ctx.sendClient({contacts:ret,requests:requests||[]});
					});
				});
		},
		pubkey: function(ctx, user) {
			if(user === undefined)
				return Error.INVALID_PARAMS;
			ctx.storage.redis.hmget("users."+user, "pubkeyN", "pubkeyE", function(err,reply) {
				if(reply[0] && reply[1])
					ctx.sendClient({user:user,pubkey:{n:reply[0],e:reply[1]}});
				else
					ctx.sendClient({error:Error.UNKNOWN_USER});
			});
		},
		conversationKey: function(ctx, user) {
			if(user === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.hget("convs."+ctx.storage.username, user, function(err,reply) {
				ctx.sendClient({user:user,convkey:reply});
			});
		},
		initConversation: function(ctx, user, convkeys) {
			if(user === undefined || !convkeys)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.multi()
				.hsetnx("convs."+ctx.storage.username,user,convkeys[0])
				.hexists("reqs."+ctx.storage.username, user)
				.exec(function(err,replies) {
					if(err)
						return helpers.dbg("redis-Error: "+err);
					if(!replies[0]||replies[1])
						return ctx.sendClient({initiated:false,with:user});
					ctx.storage.redis.hsetnx("reqs."+user,ctx.storage.username,convkeys[1],function(err,reply) {
						if(err)
							return helpers.dbg("redis-Error: "+err);
						if(!reply)
							return ctx.sendClient({initiated:false,with:user});
						ctx.sendClient({initiated:true,with:user});
						helpers.broadcast(ctx.storage,user,{user:ctx.storage.username,convkey:convkeys[1],added:true});
					});
				});
		},
		confirm: function(ctx, user) {
			if(user === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.multi()
				.hexists("convs."+ctx.storage.username,user)
				.hget("reqs."+ctx.storage.username, user)
				.hdel("reqs."+ctx.storage.username, user)
				.exec(function(err,replies) {
					if(err)
						return helpers.dbg("redis-Error: "+err);
					if(replies[0] || !replies[1])
						return ctx.sendClient({ack:false});
					ctx.storage.redis.hset("convs."+ctx.storage.username, user, replies[1], function(err,reply) {
						helpers.broadcast(ctx.storage, user, {online:true, user:ctx.storage.username});
						ctx.sendClient({ack:true});
					});
				});
		},
		countMessages: function(ctx, user) {
			if(user === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			if(user < ctx.storage.username) // lawl-sort
				var convid = user+'.'+ctx.storage.username;
			else
				var convid = ctx.storage.username+'.'+user;
			ctx.storage.redis.llen("msgs."+convid, function(err, reply) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				ctx.sendClient({msgcount:reply, user:user});
			});
		},
		retrieveMessages: function(ctx, user, start, end) {
			if(user === undefined || isNaN(start) || isNaN(end))
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			var start = parseInt(start), end = parseInt(end);
			if(isNaN(start) || isNaN(end))
				return Error.INVALID_PARAMS;
			if(user < ctx.storage.username) // lawl-sort
				var convid = user+'.'+ctx.storage.username;
			else
				var convid = ctx.storage.username+'.'+user;
			ctx.storage.redis.lrange("msgs."+convid, start, end, function(err, reply) {
				ctx.sendClient({msglist:reply.map(JSON.parse)});
			});
		},
		storeMessage: function(ctx, user, msg) {
			if(user === undefined || msg === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			var storeMsg = {ts:new Date().getTime(), from:ctx.storage.username, msg:msg},
				storeMsgJSON = JSON.stringify(storeMsg);
			if(user < ctx.storage.username) // lawl-sort
				var convid = user+'.'+ctx.storage.username;
			else
				var convid = ctx.storage.username+'.'+user;
			var pushMessage = function() { 
				helpers.broadcast(ctx.storage, user, storeMsg);
				ctx.storage.redis.smembers("sess."+ctx.storage.username, function(err,reply) {
					if(err)
						return helpers.dbg("redis-Error: "+err);
					storeMsg.to = user;
					delete storeMsg.from;
					for(var id in reply)
						if(ctx.storage.sockets[reply[id]] !== undefined // not sure if redis and node are in sync
							&& reply[id] != ctx.storage.id) // do not push back to sending session
							ctx.storage.sockets[reply[id]].send(storeMsg);
				});
				ctx.sendClient({ts:storeMsg.ts, sent:true});
			}
			ctx.storage.redis.rpushx("msgs."+convid, storeMsgJSON, function(err, reply) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				if(reply)
					pushMessage();
				else {
					ctx.storage.redis.multi()
						.hgetall("convs."+ctx.storage.username)
						.hgetall("convs."+user)
						.exec(function(err, replies){
							if(replies[0] && replies[1]
								&& Object.keys(replies[0]).indexOf(user) !== -1
								&& Object.keys(replies[1]).indexOf(ctx.storage.username) !== -1)
								ctx.storage.redis.rpush("msgs."+convid, storeMsgJSON, pushMessage);
							else
								ctx.sendClient({error:Error.NOT_ALLOWED});
						});
				}
			});
		},
		snapshot: function() {
			require('heapdump').writeSnapshot();
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

	parseRequest = function(data, ctx) {
		for(var actionName in data) {
			var action = actions[actionName];
			if (!action || action.constructor.prototype[actionName])
				return Error.INVALID_ACTION;
			if(Array.isArray(data[actionName]))
				data[actionName].unshift(ctx);
			else
				data[actionName] = [ctx];
			helpers.dbg("Calling: "+actionName+"("+data[actionName].slice(1)+")");
			return action.apply(this, data[actionName]); // only one action for now
		}
	};

exports.helpers = helpers;
exports.handleMessage = function(message, storage, callbacks) {
	helpers.dbg = callbacks.dbg;
	var result,
		data,
		seq;
	try {
		data = JSON.parse(message);
		seq = data.seq;
		delete data.seq;
	} catch (e) {
		result = Error.JSON;
	}
	if (result !== Error.JSON) 
		result = parseRequest(data, {
			storage: storage,
			sendClient: function(msg) {
				callbacks.response(msg, seq);
			}
		});
	if(!isNaN(result))
		result = {error:result};
	if(result)
		callbacks.response(result);
};
