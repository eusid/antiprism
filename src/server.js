var WebSocketServer = require("ws").Server,
	wss = new WebSocketServer({port: 8080}),
	messageController = require("./message_controller.js");

wss.on("connection", function(webSocket) {
	messageController.init(webSocket);
	webSocket.on("message", function(message) {
		messageController.handleMessage(message, function(receiver) {
			//TODO
		});
	});
});