define(['marionette', 'underscore', 'text!./templates/message.html'], function(Marionette, _, html) {
	return Marionette.ItemView.extend({
		triggers: {
			'click': 'open'
		},
		template: function(model) {
			return _.template(html)(model);
		}
	});
});