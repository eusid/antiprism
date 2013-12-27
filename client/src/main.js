define(['marionette', 'backbone', 'controllers/AppController', 'jquery', 'foundation'],
	function(Marionette, Backbone, AppController, $) {
		var App = new Marionette.Application();

		App.addRegions({
			mainRegion: '#main-content'
		});

		App.addInitializer(function() {
			var controller = new AppController({region: App.mainRegion});
			App.router = new Marionette.AppRouter({
				controller: controller,
				appRoutes: {
					'': 'index',
					'login': 'login'
				}
			});
		});
		App.on('initialize:after', function() {
			Backbone.history.start();
			$(document).foundation();

			App.router.navigate('#login', {trigger: true});
		});

		return App;
	}
);