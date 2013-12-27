define(['marionette', 'underscore', 'text!./templates/auth.html', 'jquery.transit'], function(Marionette, _, html) {
	return Marionette.ItemView.extend({
		events: {
			'change #is-new': function() {
				this.$('button').find('span').each(function() {
					var isHidden = $(this).hasClass('hide');
					$(this).transition({opacity: isHidden ? 1 : 0}, 'fast', function() {
						if (isHidden) $(this).removeClass('hide');
						else $(this).addClass('hide');
					});
				});
			},
			'keydown input': function(event) {
				$(event.target).removeClass('error').next('small.error').remove();
			},
			'submit form': function() {
				this.trigger('auth', {
					name: this.$('#username').val(),
					password: this.$('#password').val(),
					type: this.$('#isNew').is(':checked') ? 'register' : 'login'
				});
			}
		},
		template: function(model) {
			return _.template(html)(model);
		},
		addError: function(attribute, message) {
			this.$('#' + attribute).addClass('error').after(
				$('<small>', {'text': message, 'class': 'error'})
			);
		}
	});
});