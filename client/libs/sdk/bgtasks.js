importScripts('/require.js');
require({ baseUrl: './' }, ['crypto/buffer', 'crypto/jsbn.full', 'crypto/scrypt'], function(Buffer, JSBN) {
addEventListener('message', function(e) {
	var ctx = e.data,
		actions = {
			buildAESKey: function(password,salt) {
				var hash = scrypt.crypto_scrypt(scrypt.encode_utf8(password),scrypt.encode_utf8(salt), 16384, 8, 1, 32);
				return String.fromCharCode.apply(null, new Uint8Array(hash));
			},
			generateKeypair: function() {
				var rsa = new JSBN.RSA();
				rsa.generate(2048,"10001");
				return {pubkey: rsa.getPublic(), privkey: rsa.getPrivate()};
			},
			decryptRSA: function(cipher, pubkey, privkey) {
				var rsa = new JSBN.RSA();
					rsa.loadPrivate(pubkey, privkey, 2048);
				return rsa.decrypt(new Buffer(cipher,'base64').toString('hex'));
			}
		};
	if(actions[ctx.action])
		postMessage(actions[ctx.action].apply(this, ctx.params));
	else
		throw new Error("backgroundWorker: unknown action");
});
postMessage(); // ready-notifier
});