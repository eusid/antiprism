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
				var iv = parseLatin(cipher.substring(0,16));
				var cipher = parseLatin(cipher.substring(16));
				var key = parseLatin(key);
				var decrypted = CryptoJS.AES.decrypt({ciphertext:cipher},key,{iv:iv});
				return CryptoJS.enc.Utf8.stringify(decrypted);
			},
			encryptAES: function(string, key) {
				var key = parseLatin(key);
				var iv = parseLatin(rng_get_string(16));
				var cipher = CryptoJS.AES.encrypt(string, key, { iv: iv });
				return btoa(hex2a(cipher.iv+cipher.ciphertext));
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
		actions = {
			// default-usage: antiprism.init(user,password,0,0,{msg, error, loggedIn});
			init: function(user,password,server,port,callbacks) {
				ws = new WebSocket("ws://"+(server?server:"localhost")+':'+(port?port:8080));
				ws.storage = {user:user, password:password};
				ws.storage.events = callbacks;
				ws.onmessage = function(msg) {
					var response = JSON.parse(msg.data);
					debug(response);
					for(event in ws.storage.events)
						if(event in Object.keys(response))
							ws.storage.events[event](response);
				}
				ws.sendObject = function(msg) { ws.send(JSON.stringify(msg)); };
				ws.onopen = function() { actions.login(callbacks.loggedIn); };
			},
			login: function(callback) {
				ws.sendObject({action:"login",username:ws.storage.user});
				ws.storage.events["validationKey"] = function(response) {
					ws.user.pubkey = response.pubkey;
	      			try {
						var privkey = decryptAES(response.privkey,ws.storage.user.password);
						ws.storage.user.privkey = privkey;
						var validationKey = decryptRSA(response.validationKey, response.pubkey, privkey);
						ws.sendObject({action:"auth","validationKey":utf8_b64enc(validationKey)}); 
					} catch (e) {
						callback(0);
					}
				};
				ws.storage.events["loggedIn"] = callback;
			},
			close: function() {
				ws.close();
				delete ws;
			}
		};

	return actions;
})();