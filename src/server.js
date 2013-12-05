var WebSocketServer = require("ws").Server,
	webSocketServer = new WebSocketServer({port: 8080}),
	messageController = require("./message_controller.js"),
	webSockets = {}, wscount = 1,
	redis = require("redis").createClient();

// clean redis at startup
redis.keys("sess.*", function(err,reply) { // clear sessions
	for(x in reply) {
		var user = reply[x].substr(reply.indexOf(".")+1);
		redis.hdel("users."+user, "online", function(err,reply) {});
		redis.del(reply[x], function(err,reply) {});
	}
});

webSocketServer.on("connection", function(ws) {
	webSockets[wscount] = {id: wscount, ctx: function(msg){
		ws.send(JSON.stringify(msg));
	}};
	var session = webSockets[wscount++];
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
			session.redis.srem("sess."+session.username, session.id, function(err,reply) {});
			session.redis.hincrby("users."+session.username,"online",-1,function(err,reply) {});
			delete webSockets[session.id];
		});
});
