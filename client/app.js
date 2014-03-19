requirejs.config({
	"baseUrl": "libs",
    "paths": {
	  "crypto": "sdk/crypto",
	  "bootstrap": "bootstrap.min",
	  "bootbox": "bootbox.min",
	  "monsterid": "monsterid.min",
	  "crypto/jsbn": "sdk/crypto/jsbn.full"
    },
	shim: {
		'jquery.typeahead': ['jquery'],
        'bootstrap': { deps: ['jquery'] },
		'bootbox': { deps: ['bootstrap'] }
    }
});

// requirejs(['jquery','sdk/antiprism'], function($, Antiprism) {
// 	console.log($, new Antiprism());
// });

require(["../client"]);
