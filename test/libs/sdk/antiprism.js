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
				ws.sendObject({action:"conversationKey",user:user});
				events["convkey"] = function(msg) {
					if(msg.convkey)
						session.conversations[msg.user] = utils.decryptRSA(msg.convkey,session.pubkey,session.privkey);
					else
						return actions.initConversation(user,function(resp) {
							debug(resp);
							if(resp.initiated)
								callback(msg);
						});
					if(callback)
						callback(msg);
				};
			},
			registerWsCallbacks: function() {
				ws.onmessage = function(msg) {
					if(msg.data == "PONG") {
						debug("got PONG!");
						return pingfails = 3;
					}
					var response = JSON.parse(msg.data);
					for(var field in response)
						if(Object.keys(events).indexOf(field) != -1)
							events[field](response);
				};
				ws.onopen = function() {
					retries = 3;
					while(session.outqueue.length)
						ws.sendObject(session.outqueue.shift());
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
				ws.sendObject = function(msg) {
					if(ws.readyState != 1)
						return session.outqueue.push(msg);
					msg = JSON.stringify(msg);
					//debug("quering server: "+msg);
					ws.send(msg);
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
				ws.sendObject({action:"login",username:session.user});
				events["validationKey"] = function(response) {
					session.pubkey = response.pubkey;
	      			try {
						var privkey = utils.decryptAES(response.privkey,session.pass.enc);
						session.privkey = privkey;
						var validationKey = utils.decryptRSA(response.validationKey, response.pubkey, privkey);
						ws.sendObject({action:"auth","validationKey":utils.utf8_b64enc(validationKey)}); 
					} catch (e) {
						debug("wrong password", true, e);
					}
				};
				events["loggedIn"] = callback || debug;
			},
			register: function(user,password,callback) {
				if(session.user === undefined) {
					session.user = user;
					session.pass.plain = password;
					session.pass.enc = utils.buildAESKey(password);
				}
				var keypair = utils.generateKeypair();
				keypair.crypt = utils.encryptAES(keypair.privkey, session.pass.enc);
				ws.sendObject({action:"register", username:session.user, pubkey:keypair.pubkey, privkey:keypair.crypt});
				events["registered"] = callback || debug;
			},
			changePassword: function(newpass, callback) {
				var passAES = utils.buildAESKey(newpass);
				ws.sendObject({action:"changePass", privkey:utils.encryptAES(session.privkey, passAES)});
				events["updated"] = callback || debug;
			},
			setStatus: function(status, callback) {
				ws.sendObject({action:"setStatus",status:status});
				events["status"] = callback || debug;
			},
			getStatus: function(callback) {
				ws.sendObject({action:"getStatus"});
				events["status"] = callback || debug;
			},
			getContacts: function(callback) {
				ws.sendObject({action:"contacts"});
				events["contacts"] = function(msg) {
					for(var user in msg.contacts) {
						session.cache.keys[user] = msg.contacts[user].key;
						delete msg.contacts[user].key;
					}
					for(var user in msg.requests)
						session.cache.keys[user] = msg.requests[user].key;
					if(msg.requests)
						msg.requests = Object.keys(msg.requests);
					(callback||debug)(msg);
				};
			},
			initConversation: function(user,callback) {
				ws.sendObject({action:"pubkey",user:user}); // request pubkey first
				events["pubkey"] = function(msg) {
					var convkey = rng_get_string(32), keys = [];
					session.conversations[user] = convkey;
					keys.push(utils.encryptRSA(convkey, session.pubkey));
					keys.push(utils.encryptRSA(convkey, msg.pubkey));
					ws.sendObject({action:"initConversation", user:user, convkeys:keys});
				};
				events["initiated"] = callback || debug;
			},
			confirm: function(user, callback) {
				ws.sendObject({action:"confirm",user:user});
				events["ack"] = function(msg) {
					if(callback)
						callback(msg.ack); // bool
				};
			},
			countMessages: function(user, callback) {
				ws.sendObject({action:"countMessages", user:user});
				events["msgcount"] = callback || debug;
			},
			removeContact: function(user, callback) {
				ws.sendObject({action:"removeContact", user:user});
				events["removed"] = callback || debug;
			},
			getMessages: function(user, start, end, callback) { // start = -10, end = -1 -> last 10 msgs!
				ws.sendObject({action:"retrieveMessages",user:user, start:start, end:end});
				events["msglist"] = function(msg) {
					if(!session.conversations[user])
						return helpers.getKey(user, function() {
							for(var x in msg.msglist)
								msg.msglist[x].msg = utils.decryptAES(msg.msglist[x].msg, session.conversations[user]);
							callback(msg);
						});
					for(var x in msg.msglist)
						msg.msglist[x].msg = utils.decryptAES(msg.msglist[x].msg, session.conversations[user]);
					callback(msg);
				}
			},
			sendMessage: function(user, message, callback) {
				if(!session.conversations[user])
					return helpers.getKey(user, function() { actions.sendMessage(user,message,callback); });
				var encrypted = utils.encryptAES(message, session.conversations[user]);
				ws.sendObject({action:"storeMessage",user:user,msg:encrypted});
				events["sent"] = callback || debug;
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
				this.login(session.user,session.pass); // todo: still not cool :S
			},
			debug: debug
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
				debug(msg);
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
		session.conversations[msg.user] = msg.convkey;
		delete msg.convkey;
		try {
			clientEvents.added(msg);
			debug(msg);
		} catch(e) {
			debug(msg,true,e);
		}
	};
	events.online = function(msg) { clientEvents.online(msg); };
	for(action in actions)
		this.constructor.prototype[action] = actions[action]; // TODO: add chaining!
};
