# Create the list of files
files = jsbn.js\
		jsbn2.js\
		prng4.js\
		rsa.js\
		rsa2.js\
		rsa-async.js\
		ap-wrap.js\
		base64.js\
		CryptoJS.js\
		aes.js\
		buffer.js\
		scrypt.js\
		rng.js\
		sha256.js\
		jsbn.full.js

licenses =  LICENSE.txt

filename = crypto

.DEFAULT_GOAL := all

all: js

# Perform a jsLint on all the files.
jslint: ${files}
	gjslint $^

# Create an aggregated AntiprismCrypto file and a compressed js file.
js: ${files}
	@echo "Generating aggregated ${filename}.full.js"
	@echo "try { var exports = window; } catch (e) {}" > ${filename}.full.js
	@echo "(function(exports) {" >> ${filename}.full.js
	@cat $^ >> ${filename}.full.js
	#INVIDUAL EXPORT-CONFIG HERE
	@echo "exports.RSA = RSAKey;" >> ${filename}.full.js
	@echo "exports.Buffer = Buffer;" >> ${filename}.full.js
	@echo "exports.CryptoJS = CryptoJS;" >> ${filename}.full.js
	@echo "exports.scrypt = scrypt;" >> ${filename}.full.js
	#/END
	@echo "})(exports);" >> ${filename}.full.js
	@echo "Generating compressed ${filename}.min.js file"
	curl -s \
	  -d compilation_level=SIMPLE_OPTIMIZATIONS \
	  -d output_format=text \
	  -d output_info=compiled_code \
	  --data-urlencode "js_code@${filename}.full.js" \
	  http://closure-compiler.appspot.com/compile \
	  > ${filename}.min.js
	
licenses: ${licenses}
	@cat $^ > LICENSE.txt
