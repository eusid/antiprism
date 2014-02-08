var connection = null,

// Handle messages received from the server
	callbackOnMessage = function(msg) {
		try {
			var message = JSON.parse(msg.msg);
			switch(message.type) {
				// Respond to an offer
				case 'offer':
					connection.setRemoteDescription(new RTCSessionDescription(message));
					connection.createAnswer(function(sessionDescription) {
						connection.setLocalDescription(sessionDescription);
						antiprism.sendMessage(msg.from, JSON.stringify(sessionDescription));
					});
					break;
				// Respond to an answer
				case 'answer':
					connection.setRemoteDescription(new RTCSessionDescription(message));
					break;
				// Respond to an ice candidate
				case 'candidate':
					connection.addIceCandidate(new RTCIceCandidate({
						sdpMLineIndex:message.label,
						candidate:message.candidate
					}));
					break;
			}
		} catch(e) {
			utils.onMessage(msg);
		}

	};

//change STUN server if you don't trust google for requesting your public ip:port ;)
//source: apprtc.appspot.com
var cfg = {
	'iceServers': [
		{
			'url': 'stun:stun.l.google.com:19302'
		},
		{
			'url': 'turn:192.158.29.39:3478?transport=udp',
			'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
			'username': '28224511:1379330808'
		},
		{
			'url': 'turn:192.158.29.39:3478?transport=tcp',
			'credential': 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
			'username': '28224511:1379330808'
		}
	]
};

// Create the connection object
connection = new webkitRTCPeerConnection(cfg);

// Try out new ice candidates
connection.onicecandidate = function(event) {
	if(event.candidate) {
		var to = null,
			$active = $('.active');
		if($active.length)
			to = $active[0].id;
		antiprism.sendMessage(to, JSON.stringify({
			type:'candidate',
			label:event.candidate.sdpMLineIndex,
			id:event.candidate.sdpMid,
			candidate:event.candidate.candidate
		}));
	}
};

// Wire up the video stream once we get it
connection.onaddstream = function(event) {
	console.log("Stream added! ", encode(event.stream));
	var video = document.createElement("video");
	video.id = "remoteVideo";
	video.src = URL.createObjectURL(event.stream);
	video.autoplay = "autoplay";
	video.controls = "true";
	$('#messages').append(video);

};
var requestMedia = function(callback) { // Ask for access to the video and audio devices
	if(typeof callback !== "function") {
		callback = function() {};
	}
	navigator.webkitGetUserMedia({
		audio:true,
		video:true
	}, function(stream) {
		connection.addStream(stream);
		callback();
	});
};

// Kick off the negotiation with an offer request
function openConnection() {
	if(!connection.getLocalStreams().length) {
		requestMedia(openConnection);
		return;
	}
	var to = null,
		$active = $('.active');
	if($active.length)
		to = $active[0].id;
	connection.createOffer(function(sessionDescription) {
		connection.setLocalDescription(sessionDescription);
		antiprism.sendMessage(to, JSON.stringify(sessionDescription));
	});
}

function decode(msg) {
	return JSON.parse(atob(msg));
}

function encode(msg) {
	return btoa(JSON.stringify(msg));
}
document.getElementById('openConnection').onclick = openConnection;
