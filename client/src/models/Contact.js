define(['backbone'], function(Backbone) {
	return Backbone.Model.extend({
		defaults: {
			'lastMessage': ''
		},
		initialize: function() {
			var contact = this;
			antiprism.sdk.getMessages(this.get('name'), -1, -1, function(response) {
				var lastMessage = response.msglist[0];
				if (lastMessage) contact.set('lastMessage', lastMessage.msg);
			});
		},
		fetchMessages: function() {
			var contact = this;
			antiprism.sdk.getMessages(this.get('name'), -10, -1, function(response) {
				contact.set('messages', response.msglist);
			});
		}
	});
});