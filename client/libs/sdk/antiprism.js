/**
 * antiprism.js
 *
 * SDK for Project Antiprism
 * -------------------------
 *
 * check antiprismSDK.md for more infos
 */

// TODO: modularize. AMDs, seriously.
define(['crypto/buffer','crypto/jsbn','crypto/CryptoJS','crypto/aes','crypto/sha256'], function(Buffer, JSBN) {
return function(host,debugFlag) {
	// define all the methods!!11
	var retries,
		seq = 0,
		bgtasks = { queue: [], ready: false, worker: new Worker('libs/sdk/bgtasks.js') }, // how to fix this absolute path?
		utils = {
			runBackgroundTask: function(action, params, callback) {
				var call = { action: action, params: params },
					workerFinished = function(e) {
						bgtasks.worker.removeEventListener('message', workerFinished);
						callback(e.data);
					};
				if(!bgtasks.ready)
					return bgtasks.queue.push(arguments);
				debug("calling w0rker: "+action);
				bgtasks.worker.addEventListener('message', workerFinished, false);
				bgtasks.worker.postMessage(call);
			},
			parseLatin: function(string) {
				return CryptoJS.enc.Latin1.parse(string);
			},
			decryptAES: function(cipher, key) {
				cipher = new Buffer(cipher,'base64').toString();
				var iv = utils.parseLatin(cipher.substring(0,16));
				cipher = utils.parseLatin(cipher.substring(16));
				key = utils.parseLatin(key);
				var decrypted = CryptoJS.AES.decrypt({ciphertext:cipher},key,{iv:iv});
				return CryptoJS.enc.Utf8.stringify(decrypted);
			},
			encryptAES: function(string, key) {
				key = utils.parseLatin(key);
				var iv = utils.parseLatin(new JSBN.PRNG().getString(16));
				var cipher = CryptoJS.AES.encrypt(string, key, { iv: iv });
				return new Buffer(cipher.iv+cipher.ciphertext,'hex').toString('base64');
			},
			encryptRSA: function(plain, pubkey) {
				var rsa = new JSBN.RSA();
				try {
					rsa.loadPublic(pubkey, 2048);
				} catch(e) {
					return debug("invalid pubkey", true, e);
				}
				return new Buffer(rsa.encrypt(plain),'hex').toString('base64');
			}
		},
		helpers = {
			getKey: function(user, callback) {
				if(session.conversations[user])
					return callback ? callback() : 0;
				else if(session.cache.keys[user])
					return utils.runBackgroundTask(
					'decryptRSA', [session.cache.keys[user],session.pubkey,session.privkey], function(decrypted) {
						if(decrypted === null)
							return debug(session,true,"rsa decrypt for "+user+" failed, session:");
						session.conversations[user] = decrypted;
						delete session.cache.keys[user];
						return callback ? callback() : 0;
					});
				ws.callServer("conversationKey",[user],function(msg) {
					if(msg.convkey)
						utils.runBackgroundTask(
						'decryptRSA',[msg.convkey,session.pubkey,session.privkey],function(decrypted) {
							session.conversations[msg.user] = decrypted;
							if(callback)
								callback(msg);
						});
					else
						actions.initConversation(user,function(resp) {
							if(resp.initiated)
								callback(msg);
						});
				});
			},
			registerWsCallbacks: function() {
				ws.onmessage = function(msg) {
					if(msg.data == "PONG") {
						debug("got PONG, took "+(new Date().getTime()-session.pingstart)+"ms");
						return pingfails = 3;
					}
                    var response = JSON.parse(msg.data);
					if(response.error)
						clientEvents.error(null, null, response.error);
					if(response.seq && events[response.seq])
						return events[response.seq](response);
					for(var field in response)
						if(Object.keys(events).indexOf(field) != -1)
							return events[field](response);
				};
				ws.onopen = function() {
					retries = 3;
					while(session.outqueue.length)
						ws.send(session.outqueue.shift());
				};
				ws.onclose = function() {
					clearInterval(pingID);
					var callback = clientEvents.closed || function(){};
					debug("connection closed, retries: "+retries);
					if(retries-- < 1) {
						callback(false);
						return;
					}
					callback(true);
					setTimeout(function() {
						actions.reconnect(clientEvents.closed);
					},1000);
				};
				ws.callServer = function(action, params, callback) {
					var id = ++seq,
						msg = {seq:id};
					msg[action] = params;
					msg = JSON.stringify(msg);
					if(callback)
						events[id] = function(arg) {
							delete events[id];
							callback(arg);
						};
					debug("querying: "+msg);
					if(ws.readyState != ws.OPEN)
						return session.outqueue.push(msg);
					ws.send(msg);
					return seq;
				};
			}
		},
		actions = {
			/* initial callbacks:
				[on]: msg, online, added
			*/
			addEventListener: function(event,callback) {
				if(Object.keys(clientEvents).indexOf(event) === -1)
					return "unknown event";
				clientEvents[event] = callback;
			},
			getPubkey: function(user, callback) {
				ws.callServer("pubkey",[user],function(reply) {
					if(callback)
						callback(reply.pubkey);
				});
			},
			login: function(user,password,callback,storePass) { // give {hash:'<bytes>'} for raw hash login
				var doLogin = function(response) {
					try {
						var privkey = new Buffer(utils.decryptAES(response.privkey,session.pass.enc)).toString('base64');
		 			} catch (e) {
						debug("wrong password", true, e);
		                return callback(false);
					}
					session.privkey = privkey;
					utils.runBackgroundTask(
					'decryptRSA',[response.validationKey, response.pubkey, privkey], function(validationKey) {
						var hash = CryptoJS.SHA256(utils.parseLatin(validationKey)).toString(CryptoJS.enc.Base64);
						ws.callServer("auth", [hash], callback);
					});
				}
				ws.callServer("login", [user], function(response) {
					session.pubkey = response.pubkey;
					console.log("loginresponse",response);
					if(!response.salt) //TODO: get rid of this shit asap, for backwards-compability only
						session.pass.salt = "i_iz_static_salt";
					else
						session.pass.salt = new Buffer(response.salt,'base64').toString();
					if(session.user === undefined) {
						session.user = user;
						if(typeof password === 'string')
							return utils.runBackgroundTask('buildAESKey',[password, session.pass.salt],function(hash) {
								session.pass.enc = hash;
								doLogin(response);
								if(storePass)
									storePass(hash);
							});
						else
							session.pass.enc = password.hash;
					}
					doLogin(response);
				});
			},
			register: function(user,password,callback) {
				var doRegister = function() {
					utils.runBackgroundTask('generateKeypair', [], function(keypair) {
						keypair.crypt = utils.encryptAES(new Buffer((keypair.privkey),'base64').toString(), session.pass.enc);
						var salt = new Buffer(session.pass.salt).toString('base64');
						ws.callServer("register", [session.user, keypair.pubkey, keypair.crypt, salt], callback);
					});
				}
				var salt = new JSBN.PRNG().getString(32);
				if(session.user === undefined)
					utils.runBackgroundTask('buildAESKey', [password,salt], function(hash) {
						session.user = user;
						session.pass.enc = hash;
						session.pass.salt = salt;
						doRegister();
					});
				else
					doRegister();
			},
			changePassword: function(newpass, callback) {
				utils.runBackgroundTask('buildAESKey', [newpass, session.pass.salt], function(hash) {
					var privkey = new Buffer(session.privkey,'base64').toString();
					session.pass.enc = hash;
					ws.callServer("changePass", [utils.encryptAES(privkey, hash)], callback);
				});
			},
			setStatus: function(status, callback) {
				ws.callServer("setStatus",[status],callback);
			},
			getStatus: function(callback) {
				ws.callServer("getStatus",[],callback);
			},
			getContacts: function(callback) {
				ws.callServer("contacts",[],function(msg) {
					for(var user in msg.contacts) {
						session.cache.keys[user] = msg.contacts[user].key;
						delete msg.contacts[user].key;
					}
					for(var type in msg.requests) {
						for(var user in msg.requests[type])
							session.cache.keys[user] = msg.requests[type][user].key;
						msg.requests[type] = Object.keys(msg.requests[type]);
					}
					if(callback)
						callback(msg);
				});
			},
			initConversation: function(user,callback) {
				ws.callServer("pubkey", [user], function(msg) { // request pubkey first
					console.log(msg);
					var convkey = new JSBN.PRNG().getString(32), keys = [];
					session.conversations[user] = convkey;
					keys.push(utils.encryptRSA(convkey, session.pubkey));
					keys.push(utils.encryptRSA(convkey, msg.pubkey));
					ws.callServer("initConversation", [user, keys], callback);
				});
			},
			confirm: function(user, callback) {
				ws.callServer("confirm",[user],function(msg) {
					if(callback)
						callback(msg.ack); // bool
				});
			},
			deny: function(user, callback) {
				ws.callServer("deny", [user], function(msg) {
					if(callback)
						callback(msg.ack); // bool
				});
			},
			countMessages: function(user, callback) {
				ws.callServer("countMessages", [user], callback);
			},
			removeContact: function(user, callback) {
				ws.callServer("removeContact", [user], callback);
			},
			getMessages: function(user, start, end, callback) { // start = -10, end = -1 -> last 10 msgs!
				var handleMessages = function(msg) {
					if(!session.conversations[user])
						return helpers.getKey(user, function() {
							handleMessages(msg);
						});
					for(var x in msg.msglist)
						msg.msglist[x].msg = utils.decryptAES(msg.msglist[x].msg, session.conversations[user]);
					if(callback)
						callback(msg);
				};
				ws.callServer("retrieveMessages", [user, start, end], handleMessages);
			},
			sendMessage: function(user, message, callback, isTemporary) {
				if(!session.conversations[user])
					return helpers.getKey(user, function() {
						actions.sendMessage(user,message,callback);
					});
				var encrypted = utils.encryptAES(message, session.conversations[user]);
				ws.callServer("storeMessage", [user, encrypted, isTemporary], callback);
			},
			close: function() {
				retries = 0;
				ws.close();
			},
			reconnect: function(callback) {
				if(ws.readyState == ws.OPEN)
					ws.close();
				ws = new WebSocket(host);
				helpers.registerWsCallbacks();
				actions.login(session.user,session.pass); // todo: still not cool :S
			},
			createGroup: function(name, callback) {
				var plainKey = new JSBN.PRNG().getString(32),
					key = utils.encryptRSA(plainKey, session.pubkey);
				session.conversations[name] = plainKey;
				ws.callServer("createGroup",[name, key], callback);
			},
			invite: function(group, user, callback) {
				if(!session.conversations[group])
					helpers.getKey(group, function() {
						actions.invite(group, user, callback);
					});
				ws.callServer("pubkey",[user], function(msg) {
					if(!msg.pubkey)
						return;
					var key = utils.encryptRSA(session.conversations[group],msg.pubkey);
					ws.callServer("invite", [group, user, key], callback);
				});
			},
			getMembers: function(group, callback) {
				ws.callServer("members", [group], function(msg) {
					if(callback)
						callback(msg.members||msg);
				});
			},
			// <Developer-Mode>
			debug: function() { // call to get benchmarked debug-func
				var id = new Date().getTime().toString();
				console.time(id);
				return function(msg, isError, error) {
					console.timeEnd(id);
					debug(msg, isError, error);
				}
			},
			raw: function() {
				ws.callServer.apply(this, arguments);
			},
			listEvents: function() {
				return events;
			}
			// </Developer-Mode>
		};

	// Constructor nao :D
	if(host === undefined)
		return -1;
	var ws = new WebSocket(host),
		session = {pass:{}, conversations:{}, outqueue:[], inqueue:[], cache:{keys:{}}},
		pingfails = retries = 3,
		timeoutms = 25000, // say hi every 25 seconds
		events = {},
		pingID = setInterval(function() {
			debug("PiNGiNG, "+pingfails+" tries left");
			session.pingstart = new Date().getTime();
			if(pingfails--)
				ws.send("PING");
			else
				actions.close();
		}, timeoutms),
		debug = function(msg, isError, error) {
			if(!debugFlag && !isError)
				return;
			console.group(isError ? "ERROR" : "DEBUG");
			if(isError)
				console.log(error);
			if(msg)
				console.log(msg);
			console.groupEnd();
		},
		workerReady = function() {
			bgtasks.ready = true;
			bgtasks.worker.removeEventListener('message', workerReady);
			while(bgtasks.queue.length)
				utils.runBackgroundTask.apply(this, bgtasks.queue.shift());
		},
		clientEvents = {online:debug,msg:debug,added:debug,closed:debug, error:debug};
	debug("created new websocket");
	helpers.registerWsCallbacks();
	bgtasks.worker.addEventListener('message', workerReady, false);
	events.msg = function(msg) {
		var keyUser = msg.to || msg.from;
		if(session.conversations[keyUser]) {
			msg.msg = utils.decryptAES(msg.msg, session.conversations[keyUser]);
			if(clientEvents.msg)
				clientEvents.msg(msg);
			else
				return debug(msg,true,e);
		} else {
			session.inqueue.push(msg);
			helpers.getKey(keyUser, function (resp) {
				while(session.inqueue.length)
					events.msg(session.inqueue.shift());
			});
		}
	};
	events.added = function(msg) {
		utils.runBackgroundTask(
		'decryptRSA', [msg.convkey,session.pubkey,session.privkey], function(decrypted) {
			session.conversations[msg.user] = decrypted;
			delete msg.convkey;
			if(clientEvents.added)
				clientEvents.added(msg);
			else
				return debug(msg,true,e);
		});
	};
	events.online = function(msg) { clientEvents.online(msg); };
	for(var action in actions)
		this.constructor.prototype[action] = actions[action]; // TODO: add chaining!
};
});
