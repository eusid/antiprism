/**
 * server.js
 * 
 * Server for Project Antiprism
 * ----------------------------
 *
 * checkout PROTOCOL.md for server-communication
 */
var DEBUG = true, // change to your needs!
	dbg = function(text) {
		if(DEBUG)
			console.log("#AP @ "+(new Date()).toISOString()+" / "+text);
	};
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

console.log("Welcome 2 #ANTiPRiSM");
dbg("Listening on port "+(process.env.PORT||9000)+"...");

redis.keys("sess.*", function(err,reply) { // clear sessions
	for(var id in reply)
		redis.del(reply[id], function(err,reply) {});
});

webSocketServer.on("connection", function(ws) {
	webSockets[wscount] = {id: wscount, pingfail: 0, ctx: function(msg){
		if(ws.readyState === ws.OPEN)
			ws.send(JSON.stringify(msg));
		else
			ws.close();
	}};
	var session = webSockets[wscount++],
        killSocket = function () {
            ws.close();
        },
        addr = ws._socket.address(),
		ip = ws.upgradeReq.headers['x-forwarded-for'] || addr.address,
		connection = ip+':'+addr.port;
	dbg("Got connection from "+ip);
	timeouts[session.id] = setTimeout(killSocket, timeoutms);
	session.sockets = webSockets;
	session.redis = redis;
	session.dbg = dbg;
	ws
		.on("message", function(message) {
			if(message == "PING") {
				clearTimeout(timeouts[session.id]);
				timeouts[session.id] = setTimeout(killSocket, timeoutms);
				return ws.send("PONG");
            }
            messageController.handleMessage(message, session, {
				response: session.ctx,
				dbg: dbg
			});
		})
		.on("error", function() {
			dbg("ws-Error: "+arguments);
		})
		.on("close", function() {
			clearTimeout(timeouts[session.id]);
			if(session.username)
				session.redis.srem("sess."+session.username, session.id, function(err,reply) {
					session.redis.scard("sess."+session.username, function(err, reply) {
						if(err)
							return dbg("redis-Error: "+err);
						if(!parseInt(reply)) {
							session.redis.hset("users."+session.username, "lastseen", new Date().getTime(), function(err,reply) {
								if(err)
									return dbg("redis-Error: "+err);
							});
							session.redis.hgetall("convs."+session.username, function(err, contacts) {
								for (var user in contacts)
									messageController.helpers.broadcast(session, user, {online:false, user:session.username});
							});
						}
					});
				});
			dbg("Say bye to "+(session.username||"#"+session.id));
			delete webSockets[session.id];
		});
});
