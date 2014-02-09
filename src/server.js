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
	},
	port = process.env.PORT||9000,
	http = require('http'),
	file = new(require('node-static').Server)('./client'),
	webserver = http.createServer(function (req, res) {
		file.serve(req,res);
	}).listen(port),
	webSocketServer = new (require("ws").Server)({server: webserver}),
	messageController = require("./message_controller.js"),
	webSockets = {}, wscount = 1,
	serverSession = { clients: webSockets, remotes: {}, port: port },
	timeouts = {}, timeoutms = 35000, // 35s for safety
//	redis = require("redis").createClient(12996,"pub-redis-12996.us-east-1-1.1.ec2.garantiadata.com",{auth_pass:"paran0iaInc0wnz"});
	redis = require("redis").createClient(process.env.REDISPORT||undefined);

serverSession.redis = redis;
console.log("Welcome 2 #ANTiPRiSM");
dbg("Listening on port "+(process.env.PORT||9000)+"...");

redis.multi()
	.keys("sess.*")
	.keys("on.*")
	.exec(function(err,replies) { // clear sessions
		for(reply in replies)
			for(var key in replies[reply])
				redis.del(replies[reply[key]]);
	});

webSocketServer.on("connection", function(ws) {
	webSockets[wscount] = {id: wscount, sockets: webSockets, pingfail: 0, send: function(msg, seq){
		if(seq)
			msg.seq = seq;
		dbg("sending reply: "+JSON.stringify(msg));
		if(ws.readyState === ws.OPEN)
			ws.send(JSON.stringify(msg));
		else
			ws.close();
	}};
	var session = webSockets[wscount++],
        killSocket = function () {
        	dbg("killing socket #"+session.id);
            ws.close();
        },
        addr = ws._socket.address(),
		connection = ws.upgradeReq.headers['x-forwarded-for'] || addr.address;

	dbg("Got connection from "+connection);
	//timeouts[session.id] = setTimeout(killSocket, timeoutms);
	session.redis = redis;
	session.dbg = dbg;
	session.addr = connection;
	session.socket = ws;
	ws
		.on("message", function(message) {
			if(message == "PING") {
				clearTimeout(timeouts[session.id]);
				if(!session.isServer)
					timeouts[session.id] = setTimeout(killSocket, timeoutms);
				return ws.send("PONG");
            }
            messageController.handleMessage(message, session, {
				response: session.send,
				dbg: dbg,
				clearPing: function() {
					clearTimeout(timeouts[session.id]);
				}
			}, serverSession);
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
									messageController.helpers.broadcast({storage: session}, user, {online:false, user:session.username});
							});
						}
					});
				});
			dbg("Say bye to "+(session.username||"#"+session.id));
			delete webSockets[session.id];
		});
});
