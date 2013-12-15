/**
 * server.js
 * 
 * Server for Project Antiprism
 * ----------------------------
 *
 * checkout PROTOCOL.md for server-communication
 */

var http = require('http'),
	file = new(require('node-static').Server)('./test'),
	webserver = http.createServer(function (req, res) {
		file.serve(req,res);
	}).listen(process.env.PORT||9000);

var WebSocketServer = require("ws").Server,
	webSocketServer = new WebSocketServer({server: webserver}),
	messageController = require("./message_controller.js"),
	webSockets = {}, wscount = 1,
	timeouts = {}, timeoutms = 35000, // 35s for safety
	redis = require("redis").createClient();

redis.keys("sess.*", function(err,reply) { // clear sessions
	for(var id in reply)
		redis.del(reply[id], function(err,reply) {});
});

webSocketServer.on("connection", function(ws) {
	webSockets[wscount] = {id: wscount, pingfail: 0, ctx: function(msg){
		ws.send(JSON.stringify(msg));
	}};
	var session = webSockets[wscount++],
		killSocket = function() { ws.close(); };
	timeouts[session.id] = setTimeout(killSocket, timeoutms);
	session.sockets = webSockets;
	session.redis = redis;
	ws
		.on("message", function(message) {
			if(message == "PING") {
				clearTimeout(timeouts[session.id]);
				timeouts[session.id] = setTimeout(killSocket, timeoutms);
				return ws.send("PONG");
			};
			messageController.handleMessage(message, session, {
				response: session.ctx
			});
		})
		.on("error", function() {
			console.log("e", arguments);
		})
		.on("close", function() {
			clearTimeout(timeouts[session.id]);
			if(session.username)
				session.redis.srem("sess."+session.username, session.id, function(err,reply) {
					session.redis.hset("users."+session.username, "lastseen", new Date().getTime(), function(err,reply) {
						if(err)
							return console.log({error:err});
					});
					session.redis.scard("sess."+session.username, function(err, reply) {
						if(err)
							return console.log({error:err});
						if(!parseInt(reply))
							session.redis.hgetall("convs."+session.username, function(err, contacts) {
								for (var user in contacts)
									messageController.helpers.broadcast(session, user, {online:false, user:session.username});
							});
					});
				});
			delete webSockets[session.id];
		});
});
