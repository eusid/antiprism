define(['backbone', 'marionette'], function(Backbone, Marionette) {
	var chat = antiprism.sdk,
		userName;

	return Marionette.Controller.extend({
		index: function() {
			var controller = this;
			require(['underscore', 'models/Contact', 'views/OverviewLayout', 'views/ContactView', 'views/ChatView'],
				function(_, Contact, OverviewLayout, ContactView, ChatView) {
					var contacts = new Backbone.Collection([], {
							model: Contact
						}),
						overviewLayout = new OverviewLayout(),
						contactList = new Marionette.CollectionView({
							collection: contacts,
							itemView: ContactView
						}),
						chatView = new ChatView(),
						shownContact;

					contactList.on('itemview:open', function(view) {
						var contact = view.model;
						if (contact == shownContact) return;

						chatView.collection.reset();
						contact.fetchMessages();

						contact.on('change:messages', function(contact, messages) {
							chatView.collection.set(messages);
						});
						shownContact = contact;
					});

					contacts.on('change:lastMessage', function(contact) {
						// TODO: Only rerender changed model?
						contactList.render();
					});

					controller.options.region.show(overviewLayout);
					overviewLayout.contactList.show(contactList);
					overviewLayout.chat.show(chatView);

					chat.getContacts(function(message) {
						// TODO: We wouldn't need this glibber if we got RESTy contacts
						var mContacts = [];
						for (var name in message.contacts) {
							mContacts.push(_.extend(message.contacts[name], {name: name}));
						}
						contacts.set(mContacts);
					});
				});
		},
		login: function() {
			var controller = this;
			require(['views/AuthView'], function(AuthView) {
				var authView = new AuthView();
				authView.on('auth', function(user) {
					chat.init(user.name, user.password, antiprism.host, {
						msg: function() {
							console.log('wat', arguments);
						},
						error: function(message) {
							console.debug('Auth failed:', message);
							if (message.error == 'unknown user') {
								authView.addError('username', 'Unknown username')
							}
						}
					});

					var authCallback = function() {
						userName = user.name;
						authView.close();
						//TODO: Inlucde App to have access to router
						location.hash = '';
					};
					if (user.type == 'register') chat.register(authCallback);
					else chat.login(authCallback);
				});
				controller.options.region.show(authView);
			});
		}
	});
});