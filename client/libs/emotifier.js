(function (exports) {
	var getSmileyCodes = function(self) {
			var path = "/libs/smileys.JSON",
				URL = exports.location.origin + path,
				xmlhttp = new XMLHttpRequest();

			xmlhttp.onreadystatechange = function() {
				if(xmlhttp.readyState === 4 && xmlhttp.status === 200)
					self.smileyCodes = JSON.parse(xmlhttp.responseText);
			};

			xmlhttp.open("GET", URL, true);
			xmlhttp.send();
		},
		makeSpan = function(className) {
			var spn = document.createElement("span");
			spn.className = className;
			return spn;
		},
		makeEmoticons = function(smileyCode) {
			var smileyText = makeSpan("emoticon_text"),
				smileySpan = makeSpan("emoticon emoticon_" + this.smileyCodes[smileyCode]);
			smileyText.setAttribute("aria-hidden", true);
			smileyText.innerHTML = smileyCode;
			smileySpan.title = smileyCode;
			return smileyText.outerHTML + smileySpan.outerHTML;
		},
		emotify = function(text) {
			var chunks = text.split(" ");
			for(var i = 0; i < chunks.length; i++) {
				if(this.smileyCodes[chunks[i]])
					chunks[i] = makeEmoticons(chunks[i]);
			}
			return chunks.join(" ");
		};
	getSmileyCodes(this);
	exports.emotify = emotify;
})(window);