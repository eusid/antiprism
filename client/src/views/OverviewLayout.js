define(['marionette', 'underscore', 'text!./templates/overview.html'],
	function(Marionette, _, html) {
		return Marionette.Layout.extend({
			regions: {
				contactList: '.contactList',
				chat: '.chat'
			},
			template: _.template(html)()
		});
	});