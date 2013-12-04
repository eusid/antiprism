var antiprism = (function() {
	var ws,
		debug = function(obj) { console.log("[DEBUG]:"); console.log(obj); },
		utils = {
			hex2a: function(hex) {
				var str = '';
				for (var i = 0; i < hex.length; i += 2)
					str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
				return str;
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
					console.log("got key from user "+msg.user+": "+msg.convkey);
					console.log("decrypting convkey with privkey:"+ws.storage.privkey);
					console.log("decrypted convkey: "+utils.decryptRSA(msg.convkey,ws.storage.pubkey,ws.storage.privkey));
					if(msg.convkey)
						ws.storage.conversations[msg.user] = utils.decryptRSA(msg.convkey,ws.storage.pubkey,ws.storage.privkey);
					else
						return actions.initConversation(user,function(resp) {
							console.log("initiated");
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
			// default-usage: antiprism.init(user,password,0,0,{msg, error});
			init: function(user,password,server,port,callbacks) {
				ws = new WebSocket("ws://"+(server?server:"localhost")+':'+(port?port:8080));
				actions.ws = ws; // only 4 debug!
				ws.storage = {user:user, password:utils.buildAESKey(password), conversations:{}, outqueue:[], inqueue:[]};
				ws.storage.events = callbacks;
				var msgHandler = callbacks.msg;
				ws.storage.events.msg = function(msg) {
					var keyUser = msg.from ? msg.from : msg.to;
					if(ws.storage.conversations[keyUser]) {
						msg.msg = utils.decryptAES(msg.msg, ws.storage.conversations[msg.from]);
						msgHandler(msg);
					} else {
						ws.storage.inqueue.push(msg);
						helpers.getKey(msg.from, function (resp) {
							while(ws.storage.inqueue.length)
								ws.storage.events.msg(ws.storage.inqueue.shift());
						});
					}
				};
				ws.onmessage = function(msg) {
					var response = JSON.parse(msg.data);
					//debug(response);
					for(field in response)
						if(Object.keys(ws.storage.events).indexOf(field) != -1)
							ws.storage.events[field](response);
				};
				ws.onopen = function() {
					while(ws.storage.outqueue.length)
						ws.sendObject(ws.storage.outqueue.shift());
				};
				ws.sendObject = function(msg) {
					if(ws.readyState != 1)
						return ws.storage.outqueue.push(msg)
					ws.send(JSON.stringify(msg));
				};
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
				ws.storage.events["loggedIn"] = callback ? callback : debug;
			},
			register: function(callback) {
				var keypair = utils.generateKeypair();
				keypair.crypt = utils.encryptAES(keypair.privkey, ws.storage.password);
				ws.sendObject({action:"register", username:ws.storage.user, pubkey:keypair.pubkey, privkey:keypair.crypt});
				ws.storage.events["registered"] = function() { actions.login(callback?callback:debug); };
			},
			getContacts: function(callback) {
				ws.sendObject({action:"contacts"});
				ws.storage.events["contacts"] = function(msg) {
					for(user in msg.contacts)
						ws.storage.conversations[user] = utils.decryptRSA(msg.contacts[user],ws.storage.pubkey,ws.storage.privkey);
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
				ws.storage.events["initiated"] = callback ? callback : debug;
			},
			countMessages: function(user, callback) {
				ws.sendObject({action:"countMessages", user:user});
				ws.storage.events["msgcount"] = callback ? callback : debug;
			},
			getMessages: function(user, start, end, callback) { // start = -10, end = -1 -> last 10 msgs!
				ws.sendObject({action:"retrieveMessages",user:user, start:start, end:end});
				ws.storage.events["msglist"] = function(msg) {
					if(!ws.storage.conversations[user])
						return helpers.getKey(user, function() {
							for(x in msg.msglist)
								msg.msglist[x].msg = utils.decryptAES(msg.msglist[x].msg, ws.storage.conversations[user]);
							callback(msg);
						});
					for(x in msg.msglist)
						msg.msglist[x].msg = utils.decryptAES(msg.msglist[x].msg, ws.storage.conversations[user]);
					callback(msg);
				}
			},
			sendMessage: function(user, message, callback) {
				if(!ws.storage.conversations[user])
					return helpers.getKey(user, function() { actions.sendMessage(user,message,callback); });
				var encrypted = utils.encryptAES(message, ws.storage.conversations[user]);
				ws.sendObject({action:"storeMessage",user:user,msg:encrypted});
				ws.storage.events["ts"] = callback;
			},
			close: function() {
				ws.close();
				delete ws;
			},
			debug: debug
		};
	return actions;
})();