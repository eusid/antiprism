define(['backbone', 'marionette', 'models/Contact', 'views/MessageView', 'text!./templates/chat.html'],
	function(Backbone, Marionette, Contact, MessageView, html) {
		return Marionette.CompositeView.extend({
			itemView: MessageView,
			itemViewContainer: '.history',
			collection: new Backbone.Collection(),
			template: _.template(html)
		});
	}
);