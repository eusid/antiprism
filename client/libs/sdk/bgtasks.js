self.addEventListener('message', function(e) {
	window = self;
	importScripts('crypto/buffer.js','crypto/jsbn.full.js','crypto/scrypt.js');
	var ctx = e.data,
		actions = {
			buildAESKey: function(password,salt) {
				var hash = scrypt.crypto_scrypt(scrypt.encode_utf8(password),scrypt.encode_utf8(salt), 16384, 8, 1, 32);
				return String.fromCharCode.apply(null, new Uint8Array(hash));
			},
			generateKeypair: function() {
				var rsa = new RSA();
				rsa.generate(2048,"10001");
				return {pubkey: rsa.getPublic(), privkey: rsa.getPrivate()};
			},
			decryptRSA: function(cipher, pubkey, privkey) {
				var start = new Date().getTime();
					rsa = new RSA();
					rsa.loadPrivate(pubkey, privkey, 2048);
				var plain = rsa.decrypt(new Buffer(cipher,'base64').toString('hex'));
				console.log("RSA-Decrypt: "+(new Date().getTime()-start)+"ms");
				return plain;
			}
		};
	if(actions[ctx.action])
		self.postMessage(actions[ctx.action].apply(this, ctx.params));
	else
		throw new Error("backgroundWorker: unknown action");
}, false);