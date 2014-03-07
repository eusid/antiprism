/**
 * message_controller.js
 *
 * message controller for the node-server from Project Antiprism
 * -------------------------------------------------------------
 */
var RemoteAllowed = [ "pubkey","initConversation","confirm","storeMessage" ], serverSession = undefined,
	helpers = {
		broadcast: function(ctx, user, msg, callback) {
			console.log("broadcast called for "+user, msg);
			if(user.indexOf("@") !== -1) {
				helpers.forward(user, {push: msg, user: user.split("@")[0]}, ctx);
				if(callback)
					callback();
				return;
			}
			else if(user.indexOf('$') !== -1) {
				ctx.storage.redis.hgetall("convs."+user, function(err, reply) {
					console.log("broadcasting to group "+user+" from user "+msg.from+", message:", msg);
					msg.to = user;
					for(var member in reply)
						if(member !== ctx.storage.username)
							helpers.broadcast(ctx, member, msg);
					if(callback)
						callback();
				});
				return;
			}
			ctx.storage.redis.smembers("sess."+user, function(err,reply) {
				console.log(user+" has "+reply.length+" active session(s)");
				if(err)
					return helpers.dbg("redis-Error: "+err);
				for(var id in reply) {
					if(ctx.storage.sockets[reply[id]] !== undefined) // not sure if redis and node are in sync
						ctx.storage.sockets[reply[id]].send(msg);
				}
			});
			if(callback) callback();
		},
		encryptRSA: function(plain, pubkey, bits) {
			var rsa = new (require('node-bignumber').Key)(),
				hex = new Buffer(pubkey,'base64').toString('hex'),
				length = bits/4;
			try {
				rsa.setPublic(hex.substr(0,length),hex.substr(length));
			} catch(e) {
				return false;
			};
			return new Buffer(rsa.encrypt(plain),'hex').toString('base64');
		},
		attachHandler: function(ws, session) {
			var pushActions = {
					online: function(data) {
						var parts = data.user.split("@");
						if(data.online)
							serverSession.redis.sadd("on."+parts[1],parts[0])
						else
							serverSession.redis.srem("on."+parts[1],parts[0])
					}
				},
				storage = {
					loggedIn: true,
					redis: serverSession.redis,
					sockets: serverSession.clients
				};
			ws
			.on("close", function() {
				clearInterval(session.pingID);
				console.log("onclosed called for "+session.name);
				serverSession.redis.del("on."+session.name);
				delete serverSession.remotes[session.name];
			})
			.on("error", function(e) {
				delete serverSession.remotes[session.name];
			});
			return ws.onmessage = function(msg) {
				console.log("got message: "+msg.data);
				if(msg.data === "PING")
					return ws.send("PONG");
				else if(msg.data === "PONG")
					return 0; // todo: some checking
				var data = JSON.parse(msg.data);
				if(data.push) {		
					console.log("data: ",data);
					data.push.user = data.push.user+'@'+session.name;
					for(var action in pushActions)
						if(data.push[action])
							pushActions[action](data.push);
					helpers.broadcast({storage: storage, isServer:true}, data.user, data.push);
				}
				else if(data.rseq) {
					console.log("got something that looks like a reply, available callbacks:")
					console.log(session.callbacks);
					return session.callbacks[data.rseq] ? session.callbacks[data.rseq](data) : -1;
				}
				else
					for(var action in RemoteAllowed)
						if(Object.keys(data).indexOf(RemoteAllowed[action]) !== -1) {
							console.log("got here! i shall call \""+RemoteAllowed[action]+"\", data:", data);
							storage.username = data.remoteName+'@'+session.name // wtf
							var ctx = {
								sendClient: function(msg) {
									msg.rseq = data.seq;
									session.sendObject(msg);
								},
								isServer: true,
								storage: storage
							}
							console.log(parseRequest(data, ctx, true));
						}	
			};
		},
		registerServer: function(host, init, callback) {
			var hostinfo = host.split(":",2),
				server = hostinfo[0],
				port = hostinfo[1] || 80,
				registerServer = this.registerServer;
			console.log("got "+server+" and "+port);
			if(!(require("net")).isIPv4(server))
				return (require("dns")).lookup(server, 4, function(err,ip) {
					console.log("looked up "+server+", got "+err||ip);
					if(err == null)
						registerServer([ip,port].join(":"), callback);
				});
			var ws = new (require("ws"))("ws://"+host);
			ws.outqueue = [];
			ws
			.on("open",function() {
				if(init)
					serverSession.remotes[host].sendObject({registerServer:[serverSession.port]});
				if(callback)
					callback(true);
				serverSession.remotes[host].pingID = setInterval(function() {
					if(ws.readyState === ws.OPEN)
						ws.send("PING");
				}, 25000);
				console.log("said hi to "+host);
				console.log("working queue now");
				while(ws.outqueue.length)
					serverSession.remotes[host].sendObject(ws.outqueue.shift());
			});
			serverSession.remotes[host] = {
				seq: 0,
				callbacks: {},
				socket: ws,
				name: host,
				sendObject: function(msg, replyFlag) {
					if(ws.readyState != ws.OPEN)
						return ws.outqueue.push(msg);
					ws.send(JSON.stringify(msg));
				}
			};
			helpers.attachHandler(ws, serverSession.remotes[host]);
		},
		forward: function(user, message, ctx) {
			var forward = this.forward,
				parts = user.split("@"),
				username = parts[0],
				host = parts[1],
				remote = serverSession.remotes[host];
			if(remote === undefined)
				return helpers.registerServer(host, true, function(connected) {
					if(connected)
						forward(user, message, ctx);
				});
			if(!message.push) {
				for (var field in message) {
					var index = message[field].indexOf(user);
					message[field][index] = username;
				}
				var seq = ++remote.seq;
				message.seq = seq;
				message.remoteName = ctx.storage.username;
				var timer = setTimeout(function() {
					delete remote.callbacks[seq];
				},10000);
				remote.callbacks[seq] = function(msg) {
					clearTimeout(timer);
					for(field in msg)
						if(msg[field] === username) {
							msg[field] = user;
							break;
						}
					delete msg.rseq;
					delete msg.remoteName;
					ctx.sendClient(msg);
				}
			}
			console.log("["+(seq||"PUSH")+"] sending to "+[username,host].join("@"),message);
			remote.sendObject(message, seq);
		},
		getConvid: function(ctx, user) {
			if(user.indexOf('$') !== -1)
				return user;
			else if(user < ctx.storage.username) // lawl-sort
				return user+'.'+ctx.storage.username;
			else
				return ctx.storage.username+'.'+user;
		}
	},
	actions = {
		registerServer: function(ctx, port) {
			var session = ctx.storage,
				host = session.addr+':'+port;
			serverSession.remotes[host] = {
				storage: session,
				socket: session.socket,
				seq: 0,
				name: host,
				callbacks: {},
				sendObject: ctx.sendClient
			};
			session.isServer = true;
			helpers.clearPing();
			helpers.attachHandler(session.socket, serverSession.remotes[host]);
		},
		pubkey: function(ctx, user) {
			if(user === undefined)
				return Error.INVALID_PARAMS;
			if(user.indexOf("@") !== -1)
				return { forward: user };
			ctx.storage.redis.hget("users."+user, "pubkey", function(err,reply) {
				if(reply)
					ctx.sendClient({user:user,pubkey:reply});
				else
					ctx.sendClient({error:Error.UNKNOWN_USER});
			});
		},
		register: function(ctx, username, pubkey, privkey, salt) {
			ctx.storage.redis.exists("users."+username,function(err,reply) {
				if(reply)
					return ctx.sendClient({'registered':false});
				else {
					ctx.sendClient({'registered':true});
					ctx.storage.redis.hmset("users."+username, {
							pubkey: pubkey,
							privkey: privkey,
							lastseen: new Date().getTime(),
							salt: salt
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
					return ctx.sendClient({error:Error.UNKNOWN_USER});
				ctx.storage.username = username;
				var crypto = require('crypto'),
					randomString = crypto.randomBytes(32).toString(),
					sha256 = crypto.createHash('sha256'),
					ret = helpers.encryptRSA(randomString, reply.pubkey, 2048);
				if(!ret)
					return ctx.sendClient({error:UNKNOWN_PUBKEY});
				ctx.storage.validationKey = sha256.update(randomString).digest('base64');
				ctx.sendClient({
					validationKey: ret,
					pubkey: reply.pubkey,
					privkey: reply.privkey,
					salt: reply.salt
				});
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
			if(ctx.storage.validationKey == undefined || validationKey !== ctx.storage.validationKey)
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
								helpers.broadcast(ctx, user, {online:true, user:ctx.storage.username});
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
			ctx.storage.redis.hset("users."+ctx.storage.username,"status",status, function(err,reply) {
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
				.hgetall("reqs.to."+ctx.storage.username)
				.hgetall("reqs.from."+ctx.storage.username)
				.exec(function(err,replies) {
					var contacts = replies[0],
						requests = {to: replies[1] || {}, from: replies[2] || {}};
					if(!contacts)
						return ctx.sendClient({contacts:{}, requests:requests});
					var	multi = ctx.storage.redis.multi(),
						users = Object.keys(contacts).map(function (x) {
							var ret = {name: x, local: x.indexOf("@") === -1};
							if(!ret.local) {
								var parts = x.split("@");
								ret.username = parts[0];
								ret.host = parts[1];
							}
							return ret;
						}),
						opCount;
					for(var i in users) {
						if(!users[i].local)
							multi.sismember("on."+users[i].host, users[i].username);
						else
							multi.scard("sess."+users[i].name);
						multi.hmget("users."+users[i].name,"status","lastseen");
						if(opCount === undefined)
							opCount = multi.queue.length - 1;
					}
					multi.exec(function(err,replies) {
						var ret = {};
						for(var i in users) {
							var redisIndex = i*opCount,
								reply = [];
							for(var j = 0; j < opCount; j++)
								reply.push(replies[redisIndex+j]);
							ret[users[i].name] = {
								key: contacts[users[i].name],
								online: !!reply[0],
								status: users[i].local ? reply[1][0] : null,
								lastseen: users[i].local ? reply[1][1] : 0,
							};
						}
						helpers.dbg("replying to contacts-request");
						ctx.sendClient({contacts:ret,requests:requests});
					});
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
			var isRemoteUser = user.indexOf("@") !== -1,
				multi = ctx.storage.redis.multi();
			multi.hexists("convs."+user, ctx.storage.username)
			if(!ctx.isServer)
				multi.hsetnx("reqs.from."+ctx.storage.username, user, convkeys[0]);
			if(!isRemoteUser)
				multi.hsetnx("reqs.to."+user, ctx.storage.username, convkeys[1]);
			multi.exec(function(err,replies) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				if(replies[0] || !replies[1])
					return ctx.sendClient({initiated:false,with:user});
				ctx.sendClient({initiated:true,with:user});
				helpers.broadcast(ctx,user,{user:ctx.storage.username,convkey:convkeys[1],added:true});
			});
			if (user.indexOf("@") !== -1)
				return { forward: user };
		},
		confirm: function(ctx, user) {
			if(user === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			var isRemoteUser = user.indexOf("@") !== -1;
				multi = ctx.storage.redis.multi();
			if(!ctx.isServer) {
				multi
					.hexists("convs."+ctx.storage.username, user)
					.hget("reqs.to."+ctx.storage.username, user)
					.hdel("reqs.to."+ctx.storage.username, user);
				if(!isRemoteUser)
					multi
						.hget("reqs.from."+user, ctx.storage.username)
						.hdel("reqs.from."+user, ctx.storage.username);
			}
			else {
				multi
					.hexists("convs."+user,ctx.storage.username)
					.hget("reqs.from."+user, ctx.storage.username)
					.hdel("reqs.from."+user, ctx.storage.username);
			}
			multi.exec(function(err,replies) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				if(replies[0] || !replies[1])
					return ctx.sendClient({ack:false});
				if(!ctx.isServer) {
					ctx.storage.redis.hset("convs."+ctx.storage.username, user, replies[1]);
					if(!isRemoteUser)
						ctx.storage.redis.hset("convs."+user, ctx.storage.username, replies[3]);
				}
				else
					ctx.storage.redis.hset("convs."+user, ctx.storage.username, replies[1]);
				ctx.sendClient({ack:true});
			});
			helpers.broadcast(ctx, user, {online:true, user:ctx.storage.username});
			if(isRemoteUser && !ctx.isServer)
				return { forward: user };
		},
		deny: function(ctx, user) { //TODO: wont work at all right now :D
			if(user === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.hget("reqs.to."+ctx.storage.username, user, function(err, reply) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				if(reply === null)
					return ctx.sendClient({ack:false, error:Error.UNKNOWN_USER});
				ctx.storage.redis.multi()
					.hdel("reqs."+ctx.storage.username, user)
					.hdel("convs."+user, ctx.storage.username)
					.exec(function(err,replies) {
						ctx.sendClient({ack:true});
					});
			});
		},
		createGroup: function(ctx, name, key) {
			if(name === undefined || key === undefined || name[0] !== '$')
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.exists("convs."+name, function(err, reply) {
				if(err)
					return helpers.dbg("redis-Error: "+err);
				if(reply)
					return ctx.sendClient({error: Error.NOT_ALLOWED});
				ctx.storage.redis.multi()
					.hset("convs."+name, ctx.storage.username, 0)
					.hset("convs."+ctx.storage.username, name, key)
					.exec();
				ctx.sendClient({created:true});
			});
		},
		invite: function(ctx, group, user, key) {
			if(group === undefined || user === undefined || key === undefined || group[0] !== '$')
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			console.log("checking if "+ctx.storage.username+" is in convs."+group);
			ctx.storage.redis.multi()
				.hexists("convs."+group, ctx.storage.username)
				.hexists("convs."+group, user)
				.exec(function(err, replies) {
					if(!replies[0] || replies[1])
						return ctx.sendClient({error: Error.NOT_ALLOWED});
					var orig = ctx.storage.username;
					ctx.storage.username = group;
					actions.initConversation(ctx, user, [0,key]);
					ctx.storage.username = orig;
				});
		},
		members: function(ctx, group) {
			if(group === undefined || group[0] !== '$')
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			ctx.storage.redis.hkeys("convs."+group, function(err, reply) {
				if(!reply)
					return ctx.sendClient({error: Error.UNKNOWN_USER});
				if(reply.indexOf(ctx.storage.username) === -1)
					return ctx.sendClient({error: Error.NOT_ALLOWED});
				ctx.sendClient({members: reply});
			});
		},
		countMessages: function(ctx, user) {
			if(user === undefined || user === null)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			var convid = helpers.getConvid(ctx, user);
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
			var convid = helpers.getConvid(ctx, user);
			ctx.storage.redis.lrange("msgs."+convid, start, end, function(err, reply) {
				ctx.sendClient({msglist:reply.map(JSON.parse)});
			});
		},
		storeMessage: function(ctx, user, msg, isTemporary) {
			if(user === undefined || msg === undefined)
				return Error.INVALID_PARAMS;
			if(!ctx.storage.loggedIn)
				return Error.INVALID_AUTH;
			var storeMsg = {ts:new Date().getTime(), from:ctx.storage.username, msg:msg},
				storeMsgJSON = JSON.stringify(storeMsg),
				isRemoteUser = user.indexOf("@") !== -1;
			var convid = helpers.getConvid(ctx, user);
			var pushMessage = function() { 
				if(isRemoteUser)
					return;
				if(isTemporary)
					storeMsg.temp = true;
				helpers.broadcast(ctx, user, storeMsg);
				ctx.storage.redis.smembers("sess."+ctx.storage.username, function(err,reply) {
					if(err)
						return helpers.dbg("redis-Error: "+err);
					var pushMsg = Object.create(storeMsg);
					pushMsg.to = user;
					delete pushMsg.from;
					for(var id in reply)
						if(ctx.storage.sockets[reply[id]] !== undefined // not sure if redis and node are in sync
							&& reply[id] != ctx.storage.id) // do not push back to sending session
							ctx.storage.sockets[reply[id]].send(pushMsg);
				});
				ctx.sendClient({ts:storeMsg.ts, sent:true});
			}
			if(!isTemporary)
				ctx.storage.redis.rpushx("msgs."+convid, storeMsgJSON, function(err, reply) {
					if(err)
						return helpers.dbg("redis-Error: "+err);
					if(reply)
						pushMessage();
					else {
						var rediscallback = function(err, reply){
							if(reply)
								ctx.storage.redis.rpush("msgs."+convid, storeMsgJSON, pushMessage);
							else
								ctx.sendClient({error:Error.NOT_ALLOWED});
						};
						if(!ctx.isServer)
							ctx.storage.redis.hexists("convs."+ctx.storage.username, user, rediscallback)
						else
							ctx.storage.redis.hexists("convs."+user, ctx.storage.username, rediscallback);
					}
				});
			else
				ctx.storage.redis.hexists("convs."+ctx.storage.username,user,function(err,reply) {
					if(reply)
						pushMessage();
					else
						ctx.sendClient({error:Error.NOT_ALLOWED});
				});
			if(isRemoteUser && !ctx.isServer)
				return { forward: user };
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

	parseRequest = function(data, ctx, isServerRequest) {
		for(var actionName in data) {
			if(actionName === 'seq')
				continue; // dirteeeeeeeh
			var action = actions[actionName];
			if (!action || action.constructor.prototype[actionName]
						|| (isServerRequest && RemoteAllowed.indexOf(actionName) == -1))
				return Error.INVALID_ACTION;
			if(Array.isArray(data[actionName]))
				data[actionName].unshift(ctx);
			else
				data[actionName] = [ctx];
			helpers.dbg("Calling: "+actionName+"("+data[actionName].slice(1)+")");
			var ret = action.apply(this, data[actionName]); // only one action for now
			if(typeof ret === 'object' && ret.forward) {
				data[actionName].shift();
				return helpers.forward(ret.forward, data, ctx);
			}
			return ret;
		}
	};

exports.helpers = helpers;
exports.handleMessage = function(message, storage, callbacks, session) {
	helpers.dbg = callbacks.dbg;
	helpers.clearPing = callbacks.clearPing;
	serverSession = session;
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
	if (result !== Error.JSON) {
		result = parseRequest(data, {
			storage: storage,
			sendClient: function(msg) {
				callbacks.response(msg, seq);
			}
		});
		if(!isNaN(result))
			callbacks.response({error:result}, seq);
	}
	else
		callbacks.response(Error.JSON);
};
