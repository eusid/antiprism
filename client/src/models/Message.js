define(['backbone'], function(Backbone) {
	return Backbone.Model.extends({
		parse: function() {
			console.log(23, arguments);
		}
	});
});