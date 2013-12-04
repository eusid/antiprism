var SimpleInclude = (function () {
	var files = [
			"libs/jquery-2.0.3.min.js",
			"libs/jsbn.js",
			"libs/jsbn2.js",
			"libs/prng4.js",
			"libs/rng.js",
			"libs/rsa.js",
			"libs/rsa2.js",
			"libs/aes.js",
			"libs/CryptJS-core-min.js",
			"libs/scrypt.js",
			"antiprismSDK.js",
			"client.js"
		],
		include = function(path) {
			var x = document.createElement("script");
			x.src = path;
			document.head.appendChild(x);
		};

	for(i in files)
		include(files[i]);
	return include;
})();
