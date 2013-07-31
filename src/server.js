var WebSocketServer = require("ws").Server,
	webSocketServer = new WebSocketServer({port: 8080}),
	messageController = require("./message_controller.js"),
	webSockets = {};

webSocketServer.on("connection", function(ws) {
	webSockets[ws] = {};

	ws
		.on("message", function(message) {
			messageController.handleMessage(message, {
				response: function(response) {
					ws.send(JSON.stringify(response));
				},
				session: function(data) {

				}
			});
		})
		.on("error", function() {
			console.log("e", arguments);
		})
		.on("close", function() {
			delete webSockets[ws];
		});
});
