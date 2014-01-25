/**
 * antiprism.js
 *
 * SDK for Project Antiprism
 * -------------------------
 *
 * check antiprismSDK.md for more infos
 */

var Antiprism = function(host,debugFlag) {
	// define all the methods!!11
	var retries,
		seq = 0,
		utils = {
			hex2a: function(hex) {
				var str = '';
				for (var i = 0; i < hex.length; i += 2)
					str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
				return str;
			},
			a2hex: function(bin) {
				var ret = "";
				for(var i = 0; i < bin.length; i++)
					ret+= bin.charCodeAt(i).toString(16);
				return ret;
			},
			parseLatin: function(string) {
				return CryptoJS.enc.Latin1.parse(string);
			},
			utf8_b64enc: function(string) {
				return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(string));
			},
			utf8_b64dec: function(string) {
				return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(string));
			},
			decryptAES: function(cipher, key) {
				cipher = atob(cipher);
				var iv = utils.parseLatin(cipher.substring(0,16));
				cipher = utils.parseLatin(cipher.substring(16));
				key = utils.parseLatin(key);
				var decrypted = CryptoJS.AES.decrypt({ciphertext:cipher},key,{iv:iv});
				return CryptoJS.enc.Utf8.stringify(decrypted);
			},
			encryptAES: function(string, key) {
				key = utils.parseLatin(key);
				var iv = utils.parseLatin(rng_get_string(16));
				var cipher = CryptoJS.AES.encrypt(string, key, { iv: iv });
				return btoa(utils.hex2a(cipher.iv+cipher.ciphertext));
			},
			buildAESKey: function(password) {
				var salt = "i_iz_static_salt";
				var hash = scrypt.crypto_scrypt(scrypt.encode_utf8(password),scrypt.encode_utf8(salt), 16384, 8, 1, 32);
				return String.fromCharCode.apply(null, new Uint8Array(hash));
			},
			generateKeypair: function() {
				var rsa = new RSAKey();
				rsa.generate(2048,"10001");
				var pubkey = {};
				pubkey.n = rsa.n.toString(16);
				pubkey.e = rsa.e.toString(16);
				return {pubkey: pubkey, privkey: rsa.d.toString(16)};
			},
			encryptRSA: function(plain, pubkey) {
				var rsa = new RSAKey();
				rsa.setPublic(pubkey.n, pubkey.e);
				return rsa.encrypt(plain);
			},
			decryptRSA: function(cipher, pubkey, privkey) {
				var rsa = new RSAKey();
				rsa.setPrivate(pubkey.n, pubkey.e, privkey);
				return rsa.decrypt(cipher);
			}
		},
		helpers = {
			getKey: function(user, callback) {
				if(session.conversations[user])
					return callback ? callback() : 0;
				else if(session.cache.keys[user]) {
					session.conversations[user] = utils.decryptRSA(session.cache.keys[user],session.pubkey,session.privkey);
					delete session.cache.keys[user];
					return callback ? callback() : 0;
				}
				ws.callServer("conversationKey",[user],function(msg) {
					if(msg.convkey)
						session.conversations[msg.user] = utils.decryptRSA(msg.convkey,session.pubkey,session.privkey);
					else
						return actions.initConversation(user,function(resp) {
							if(resp.initiated)
								callback(msg);
						});
					if(callback)
						callback(msg);
				});
			},
			registerWsCallbacks: function() {
				ws.onmessage = function(msg) {
					if(msg.data == "PONG") {
						debug("got PONG!");
						return pingfails = 3;
					}
					var response = JSON.parse(msg.data);
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
					if(clientEvents.closed)
						clientEvents.closed(true);
					debug("connection closed, retries: "+retries)
					if(!retries--)
						return;
					setTimeout(function() {
						actions.reconnect();
					},1000);
				};
				ws.callServer = function(action, params, callback) {
					var msg = {seq:++seq};
					msg[action] = params;
					msg = JSON.stringify(msg);
					if(callback)
						events[seq] = function(arg) {
							delete events[seq];
							callback(arg);
						}
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
				[on]: error, msg, online, added
			*/
			addEventListener: function(event,callback) {
				if(Object.keys(clientEvents).indexOf(event) === -1)
					return "unknown event";
				clientEvents[event] = callback;
			},
			login: function(user,password,callback) {
				if(session.user === undefined) {
					session.user = user;
					session.pass.plain = password;
					session.pass.enc = utils.buildAESKey(password);
				}
				ws.callServer("login", [session.user], function(response) {
					session.pubkey = response.pubkey;
					try {
						var privkey = utils.decryptAES(response.privkey,session.pass.enc);
						session.privkey = privkey;
						var validationKey = utils.decryptRSA(response.validationKey, response.pubkey, privkey);
						ws.callServer("auth", [utils.utf8_b64enc(validationKey)], callback); 
					} catch (e) {
						debug("wrong password", true, e);
					}
				});
			},
			register: function(user,password,callback) {
				if(session.user === undefined) {
					session.user = user;
					session.pass.plain = password;
					session.pass.enc = utils.buildAESKey(password);
				}
				var keypair = utils.generateKeypair();
				keypair.crypt = utils.encryptAES(keypair.privkey, session.pass.enc);
				ws.callServer("register", [session.user, keypair.pubkey, keypair.crypt], callback);
			},
			changePassword: function(newpass, callback) {
				var passAES = utils.buildAESKey(newpass);
				ws.callServer("changePass", [utils.encryptAES(session.privkey, passAES)], callback);
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
					for(user in msg.requests)
						session.cache.keys[user] = msg.requests[user].key;
					if(msg.requests)
						msg.requests = Object.keys(msg.requests);
					if(callback)
						callback(msg);
				});
			},
			initConversation: function(user,callback) {
				ws.callServer("pubkey", [user], function(msg) { // request pubkey first
					var convkey = rng_get_string(32), keys = [];
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
				}
				ws.callServer("retrieveMessages", [user, start, end], handleMessages);
			},
			sendMessage: function(user, message, callback) {
				if(!session.conversations[user])
					return helpers.getKey(user, function() {
						actions.sendMessage(user,message,callback);
					});
				var encrypted = utils.encryptAES(message, session.conversations[user]);
				ws.callServer("storeMessage",[user,encrypted], callback);
			},
			close: function() {
				retries = 0;
				ws.close();
			},
			reconnect: function(callback) {
				if(ws.readyState != 1)
					ws.close();
				ws = new WebSocket(host);
				helpers.registerWsCallbacks();
				actions.login(session.user,session.pass); // todo: still not cool :S
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
				var args = [];
				for(var x in arguments)
					args.push(arguments[x]);
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
		clientEvents = {online:debug,msg:debug,error:debug,added:debug};
	debug("created new websocket");
	helpers.registerWsCallbacks();
	events.msg = function(msg) {
		var keyUser = msg.to || msg.from;
		if(session.conversations[keyUser]) {
			msg.msg = utils.decryptAES(msg.msg, session.conversations[keyUser]);
			try {
				clientEvents.msg(msg);
			} catch(e) {
				debug(msg,true,e);
			}
		} else {
			session.inqueue.push(msg);
			helpers.getKey(keyUser, function (resp) {
				while(session.inqueue.length)
					events.msg(session.inqueue.shift());
			});
		}
	};
	events.added = function(msg) {
		session.conversations[msg.user] = utils.decryptRSA(msg.convkey,session.pubkey,session.privkey);
		delete msg.convkey;
		try {
			clientEvents.added(msg);
		} catch(e) {
			debug(msg,true,e);
		}
	};
	events.online = function(msg) { clientEvents.online(msg); };
	for(action in actions)
		this.constructor.prototype[action] = actions[action]; // TODO: add chaining!
};
