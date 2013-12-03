var WebSocketServer = require("ws").Server,
	webSocketServer = new WebSocketServer({port: 8080}),
	messageController = require("./message_controller.js"),
	webSockets = {}, wscount = 0,
	redis = require("redis").createClient();

redis.keys("users.*.sess", function(err,reply) { // clear sessions
	for(x in reply)
		redis.del(reply[x], function(err,reply) {});
});

webSocketServer.on("connection", function(ws) {
	webSockets[wscount] = {id: wscount, ctx: function(msg){
		ws.send(JSON.stringify(msg));
	}};
	var session = webSockets[wscount];
	wscount += 1;
	session.sockets = webSockets;
	session.redis = redis;
	ws
		.on("message", function(message) {
			messageController.handleMessage(message, session, {
				response: function(result) {
					ws.send(JSON.stringify(result));
				}
			});
		})
		.on("error", function() {
			console.log("e", arguments);
		})
		.on("close", function() {
			session.redis.srem("users."+session.username+".sess", session.id, function(err,reply) {});
			delete webSockets[session.id];
		});
});
