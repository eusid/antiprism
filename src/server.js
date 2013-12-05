var http = require('http'),
	file = new(require('node-static').Server)('./test'),
	webserver = http.createServer(function (req, res) {
		file.serve(req,res);
	}).listen(process.env.PORT||9000);

var WebSocketServer = require("ws").Server,
	webSocketServer = new WebSocketServer({server: webserver}),
	messageController = require("./message_controller.js"),
	webSockets = {}, wscount = 1,
	redis = require("redis").createClient();

redis.keys("sess.*", function(err,reply) { // clear sessions
	for(id in reply)
		redis.del(reply[id], function(err,reply) {});
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
			session.redis.srem("sess."+session.username, session.id, function(err,reply) {
				session.redis.scard("sess."+session.username, function(err, reply) {
					if(err)
						return console.log({error:err});
					if(!parseInt(reply))
						session.redis.hgetall("convs."+session.username, function(err, contacts) {
							for (user in contacts)
								messageController.helpers.broadcast(session, user, {online:false, user:session.username});
						});
				});
			});
			delete webSockets[session.id];
		});
});
