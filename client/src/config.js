require.config({
	paths: {
		backbone: '../../libs/backbone/backbone',
		jquery: '../libs/jquery/jquery',
		'jquery.transit': '../libs/jquery.transit/jquery.transit',
		marionette: '../libs/marionette/lib/backbone.marionette',
		underscore: '../libs/underscore/underscore',
		text: '../libs/requirejs-text/text',
		foundation: "../libs/foundation/js/foundation",
		sdk: 'sdk/antiprism'
	},
	shim: {
		jquery: {
			exports: 'jQuery'
		},
		'jquery-transit': {
			deps: ['jquery']
		},
		underscore: {
			exports: '_'
		},
		foundation: {
			deps: ['jquery']
		},
		backbone: {
			deps: ['jquery', 'underscore'],
			exports: 'Backbone'
		},
		marionette: {
			deps: ['jquery', 'underscore', 'backbone'],
			exports: 'Marionette'
		},
		sdk: {
			exports: 'antiprism'
		}
	}
});

window.antiprism = {
	host: location.origin.replace('http', 'ws'),
	sdk: antiprism
};

require(['main'], function(App) {
	App.start();
});