/**
 * antiprism.js
 *
 * SDK for Project Antiprism
 * -------------------------
 */

var antiprism = (function() {
	var ws,
		restore = {},
		debug = function(obj) { console.log("[DEBUG]:"); console.log(obj); },
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
				var cipher = utils.parseLatin(cipher.substring(16));
				var key = utils.parseLatin(key);
				var decrypted = CryptoJS.AES.decrypt({ciphertext:cipher},key,{iv:iv});
				return CryptoJS.enc.Utf8.stringify(decrypted);
			},
			encryptAES: function(string, key) {
				var key = utils.parseLatin(key);
				var iv = utils.parseLatin(rng_get_string(16));
				var cipher = CryptoJS.AES.encrypt(string, key, { iv: iv });
				return btoa(utils.hex2a(cipher.iv+cipher.ciphertext));
			},
			buildAESKey: function(password) {
				var salt = "i_iz_static_salt";
				var hash = scrypt.crypto_scrypt(scrypt.encode_utf8(password),scrypt.encode_utf8(salt), 16384, 8, 1, 32)
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
				if(ws.storage.conversations[user])
					callback()
				ws.sendObject({action:"conversationKey",user:user});
				ws.storage.events["convkey"] = function(msg) {
					if(msg.convkey)
						ws.storage.conversations[msg.user] = utils.decryptRSA(msg.convkey,ws.storage.pubkey,ws.storage.privkey);
					else
						return actions.initConversation(user,function(resp) {
							debug(resp);
							if(resp.initiated)
								callback(msg);
						});
					if(callback)
						callback(msg);
				};
			}
		},
		actions = {
			// default-usage: antiprism.init(user,password,ws_link,callbacks);
			/* initial callbacks:
				[on]: error, msg, online, added
			*/
			init: function(user,password,host,callbacks) {
				ws = new WebSocket(host);
				restore.privs = [user,password,host,callbacks];
				actions.ws = ws; // only 4 debug!
				ws.storage = {user:user, password:utils.buildAESKey(password), conversations:{}, outqueue:[], inqueue:[]};
				ws.storage.pingfails = 0;
				ws.storage.events = callbacks;
				var origHandlers = {msg:callbacks.msg, added:callbacks.added},
					timeoutms = 25000; // say hi every 25 seconds
				ws.storage.events.msg = function(msg) {
					var keyUser = msg.to || msg.from;
					if(ws.storage.conversations[keyUser]) {
						msg.msg = utils.decryptAES(msg.msg, ws.storage.conversations[keyUser]);
						origHandlers.msg(msg);
					} else {
						ws.storage.inqueue.push(msg);
						helpers.getKey(keyUser, function (resp) {
							while(ws.storage.inqueue.length)
								ws.storage.events.msg(ws.storage.inqueue.shift());
						});
					}
				};
				ws.storage.events.added = function(msg) {
					ws.storage.conversations[msg.user] = msg.convkey;
					delete msg.convkey;
					origHandlers.added(msg);
				};
				ws.onmessage = function(msg) {
					if(msg.data == "PONG")
						return --ws.storage.pingfails;
					var response = JSON.parse(msg.data);
					for(var field in response)
						if(Object.keys(ws.storage.events).indexOf(field) != -1)
							ws.storage.events[field](response);
				};
				ws.onopen = function() {
					while(ws.storage.outqueue.length)
						ws.sendObject(ws.storage.outqueue.shift());
				};
				ws.onclose = function() {
					clearInterval(ws.storage.pingID);
					console.log("DEBUG: connection closed");
					if(!restore.SUICIDE && restore.SUICIDE) { // widerspruch :O
						actions.init.apply(this, restore.privs);
						actions.login();
						return;
					}
					delete ws.storage;
				}
				ws.sendObject = function(msg) {
					if(ws.readyState != 1)
						return ws.storage.outqueue.push(msg)
					//console.log("quering server:");console.log(msg);
					ws.send(JSON.stringify(msg));
				};
				ws.storage.pingID = setInterval(function() {
					if(++ws.storage.pingfails < 2)
						ws.send("PING");
					else {
						console.log("server doesn't answer, suicide now :(");
						actions.close();
					}
				}, timeoutms);
			},
			login: function(callback) {
				ws.sendObject({action:"login",username:ws.storage.user});
				ws.storage.events["validationKey"] = function(response) {
					ws.storage.pubkey = response.pubkey;
	      			try {
						var privkey = utils.decryptAES(response.privkey,ws.storage.password);
						ws.storage.privkey = privkey;
						var validationKey = utils.decryptRSA(response.validationKey, response.pubkey, privkey);
						ws.sendObject({action:"auth","validationKey":utils.utf8_b64enc(validationKey)}); 
					} catch (e) {
						callback(0);
					}
				};
				ws.storage.events["loggedIn"] = callback || debug;
			},
			register: function(callback) {
				var keypair = utils.generateKeypair();
				keypair.crypt = utils.encryptAES(keypair.privkey, ws.storage.password);
				ws.sendObject({action:"register", username:ws.storage.user, pubkey:keypair.pubkey, privkey:keypair.crypt});
				ws.storage.events["registered"] = function() { actions.login(callback || debug); };
			},
			changePassword: function(newpass, callback) {
				var passAES = utils.buildAESKey(newpass);
				ws.sendObject({action:"changePass", privkey:utils.encryptAES(ws.storage.privkey, passAES)});
				ws.storage.events["updated"] = callback || debug;
			},
			setStatus: function(status, callback) {
				ws.sendObject({action:"setStatus",status:status});
				ws.storage.events["status"] = callback || debug;
			},
			getStatus: function(callback) {
				ws.sendObject({action:"getStatus"});
				ws.storage.events["status"] = callback || debug;
			},
			getContacts: function(callback) {
				ws.sendObject({action:"contacts"});
				ws.storage.events["contacts"] = function(msg) {
					for(var user in msg.contacts)
						ws.storage.conversations[user] = utils.decryptRSA(msg.contacts[user].key,ws.storage.pubkey,ws.storage.privkey);
					callback(msg);
				};
			},
			initConversation: function(user,callback) {
				ws.sendObject({action:"pubkey",user:user}); // request pubkey first
				ws.storage.events["pubkey"] = function(msg) {
					var convkey = rng_get_string(32), keys = [];
					ws.storage.conversations[user] = convkey;
					keys.push(utils.encryptRSA(convkey, ws.storage.pubkey));
					keys.push(utils.encryptRSA(convkey, msg.pubkey));
					ws.sendObject({action:"initConversation", user:user, convkeys:keys});
				}
				ws.storage.events["initiated"] = callback || debug;
			},
			countMessages: function(user, callback) {
				ws.sendObject({action:"countMessages", user:user});
				ws.storage.events["msgcount"] = callback || debug;
			},
			removeContact: function(user, callback) {
				ws.sendObject({action:"removeContact", user:user});
				ws.storage.events["removed"] = callback || debug;
			},
			getMessages: function(user, start, end, callback) { // start = -10, end = -1 -> last 10 msgs!
				ws.sendObject({action:"retrieveMessages",user:user, start:start, end:end});
				ws.storage.events["msglist"] = function(msg) {
					if(!ws.storage.conversations[user])
						return helpers.getKey(user, function() {
							for(var x in msg.msglist)
								msg.msglist[x].msg = utils.decryptAES(msg.msglist[x].msg, ws.storage.conversations[user]);
							callback(msg);
						});
					for(var x in msg.msglist)
						msg.msglist[x].msg = utils.decryptAES(msg.msglist[x].msg, ws.storage.conversations[user]);
					callback(msg);
				}
			},
			sendMessage: function(user, message, callback) {
				if(!ws.storage.conversations[user])
					return helpers.getKey(user, function() { actions.sendMessage(user,message,callback); });
				var encrypted = utils.encryptAES(message, ws.storage.conversations[user]);
				ws.sendObject({action:"storeMessage",user:user,msg:encrypted});
				ws.storage.events["sent"] = callback;
			},
			close: function() {
				restore.SUICIDE = true; // TODO: implement this!
				ws.close();
			},
			debug: debug
		};
	return actions;
})();
