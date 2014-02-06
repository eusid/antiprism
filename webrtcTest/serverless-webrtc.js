///* See also:
// http://www.html5rocks.com/en/tutorials/webrtc/basics/
// https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html
//
// https://webrtc-demos.appspot.com/html/pc1.html
// */
//
//var cfg = {"iceServers":[
//		{"url":"stun:23.21.150.121"}
//	]},
//	con = { 'optional':[
//		{'DtlsSrtpKeyAgreement':true},
//		{'RtpDataChannels':true }
//	] };
//
///* THIS IS ALICE, THE CALLER/SENDER */
//
//var pc1 = new RTCPeerConnection(cfg, con),
//	dc1 = null, tn1 = null;
//
//// Since the same JS file contains code for both sides of the connection,
//// activedc tracks which of the two possible datachannel variables we're using.
//var activedc;
//
//var pc1icedone = false;
//
///*$('#offerRecdBtn').click(function() {
//	var offer = $('#remoteOffer').val();
//	var offerDesc = new RTCSessionDescription(JSON.parse(offer));
//	console.log("Received remote offer", offerDesc);
//	writeToChatLog("Received remote offer", "text-success");
//	handleOfferFromPC1(offerDesc);
//});
//
//$('#answerRecdBtn').click(function() {
//	var answer = $('#remoteAnswer').val();
//	var answerDesc = new RTCSessionDescription(JSON.parse(answer));
//	handleAnswerFromPC2(answerDesc);
//	$('#waitForConnection').modal('show');
//});
//
//$('#fileBtn').change(function() {
//	var file = this.files[0];
//	console.log(file);
//
//	sendFile(file);
//});*/
//
//function fileSent(file) {
//	console.log(file + " sent");
//}
//
//function fileProgress(file) {
//	console.log(file + " progress");
//}
//
//function sendFile(data) {
//	if(data.size) {
//		FileSender.send({
//			file:data,
//			onFileSent:fileSent,
//			onFileProgress:fileProgress,
//		});
//	}
//}
//function sendMessage() {
//	if($('#messageTextBox').val()) {
//		var channel = new RTCMultiSession();
//		writeToChatLog($('#messageTextBox').val(), "text-success");
//		channel.send({message:$('#messageTextBox').val()});
//		$('#messageTextBox').val("");
//
//		// Scroll chat text area to the bottom on new input.
//		$('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
//	}
//
//	return false;
//};
//
//function setupDC1() {
//	try {
//		var fileReceiver1 = new FileReceiver();
//		dc1 = pc1.createDataChannel('test', {reliable:true});
//		activedc = dc1;
//		console.log("Created datachannel (pc1)");
//		dc1.onmessage = function(e) {
//			console.log("Got message (pc1)", e.data);
//			if(e.data.size) {
//				fileReceiver1.receive(e.data, {});
//			}
//			else {
//				var data = JSON.parse(e.data);
//				if(data.type === 'file') {
//					fileReceiver1.receive(e.data, {});
//				}
//				else {
//					writeToChatLog(data.message, "text-info");
//					// Scroll chat text area to the bottom on new input.
//					$('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
//				}
//			}
//		};
//	} catch(e) { console.warn("No data channel (pc1)", e); }
//}
//
//getUserMedia({'audio':true, fake:true, video:true}, function(stream) {
//	globalStream = stream;
//	console.log("Got local audio", stream);
//	pc1.addStream(stream);
//	setupDC1();
//	pc1.createOffer(function(offerDesc) {
//		console.log("Created local offer", offerDesc);
//		pc1.setLocalDescription(offerDesc);
//		$('#localOffer').html(JSON.stringify(offerDesc));
//	}, function() { console.warn("Couldn't create offer"); });
//}, function(e) { console.warn("Got UserMediaError: " + JSON.stringify(e)); });
//
//pc1.onicecandidate = function(e) {
//	console.log("ICE candidate (pc1)", e);
//	if(e.candidate) {
//		//handleCandidateFromPC1(e.candidate)
//		if(!pc1icedone) {
//			document.localICECandidateForm.localICECandidate.value = JSON.stringify(e.candidate);
//			pc1icedone = true;
//		}
//	}
//};
//
//function handleOnconnection() {
//	console.log("Datachannel connected");
//	writeToChatLog("Datachannel connected", "text-success");
//	$('#waitForConnection').modal('hide');
//	// If we didn't call remove() here, there would be a race on pc2:
//	//   - first onconnection() hides the dialog, then someone clicks
//	//     on answerSentBtn which shows it, and it stays shown forever.
//	$('#waitForConnection').remove();
//	$('#showLocalAnswer').modal('hide');
//	$('#messageTextBox').focus();
//}
//
//pc1.onconnection = handleOnconnection;
//
//function handleAnswerFromPC2(answerDesc) {
//	console.log("Received remote answer: ", answerDesc);
//	writeToChatLog("Received remote answer", "text-success");
//	pc1.setRemoteDescription(answerDesc);
//}
//
//function handleCandidateFromPC2(iceCandidate) {
//	pc1.addIceCandidate(iceCandidate);
//}
//
///* THIS IS BOB, THE ANSWERER/RECEIVER */
//
//var pc2 = new RTCPeerConnection(cfg, con),
//	dc2 = null;
//
//var pc2icedone = false;
//
//pc2.ondatachannel = function(e) {
//	var fileReceiver2 = new FileReceiver();
//	var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
//	console.log("Received datachannel (pc2)", arguments);
//	dc2 = datachannel;
//	activedc = dc2;
//	dc2.onmessage = function(e) {
//		console.log("Got message (pc2)", e.data);
//		if(e.data.size) {
//			fileReceiver2.receive(e.data, {});
//		}
//		else {
//			var data = JSON.parse(e.data);
//			if(data.type === 'file') {
//				fileReceiver2.receive(e.data, {});
//			}
//			else {
//				writeToChatLog(data.message, "text-info");
//				// Scroll chat text area to the bottom on new input.
//				$('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
//			}
//		}
//	};
//};
//
//function handleOfferFromPC1(offerDesc) {
//	pc2.setRemoteDescription(offerDesc);
//	pc2.createAnswer(function(answerDesc) {
//		writeToChatLog("Created local answer", "text-success");
//		console.log("Created local answer: ", answerDesc);
//		pc2.setLocalDescription(answerDesc);
//		$('#localAnswer').html(JSON.stringify(answerDesc));
//	}, function() { console.warn("No create answer"); });
//}
//
//pc2.onicecandidate = function(e) {
//	console.log("ICE candidate (pc2)", e);
//	if(e.candidate)
//		handleCandidateFromPC2(e.candidate);
//};
//
//function handleCandidateFromPC1(iceCandidate) {
//	pc2.addIceCandidate(iceCandidate);
//}
//
//pc2.onaddstream = function(e) {
//	console.log("Got remote stream", e);
//	var el = new Audio();
//	el.autoplay = true;
//	attachMediaStream(el, e.stream);
//};
//
//pc2.onconnection = handleOnconnection;
//
//function getTimestamp() {
//	var totalSec = new Date().getTime() / 1000;
//	var hours = parseInt(totalSec / 3600) % 24;
//	var minutes = parseInt(totalSec / 60) % 60;
//	var seconds = parseInt(totalSec % 60);
//
//	var result = (hours < 10 ? "0" + hours : hours) + ":" +
//		(minutes < 10 ? "0" + minutes : minutes) + ":" +
//		(seconds < 10 ? "0" + seconds : seconds);
//
//	return result;
//}
//
//function writeToChatLog(message, message_type) {
//	document.getElementById('chatlog').innerHTML += '<p class=\"' + message_type + '\">' + "[" + getTimestamp() + "] " + message + '</p>';
//};
//var isChrome = !!navigator.webkitGetUserMedia;
//
//var STUN = {
//	url:isChrome
//		? 'stun:stun.l.google.com:19302'
//		: 'stun:23.21.150.121'
//};
//
//var TURN = {
//	url:'turn:homeo@turn.bistri.com:80',
//	credential:'homeo'
//};
//
//var iceServers = {
//	iceServers:[STUN, TURN]
//};
//
//// DTLS/SRTP is preferred on chrome
//// to interop with Firefox
//// which supports them by default
//
//var DtlsSrtpKeyAgreement = {
//	DtlsSrtpKeyAgreement:true
//};
//
//var optional = {
//	optional:[DtlsSrtpKeyAgreement]
//};
//var ownPC = new RTCPeerConnection(iceServers, optional),
//	ownVideo = document.getElementById('ownVideo'),
//	remoteVideo = document.getElementById('remoteVideo');
//
//navigator.getMedia = (navigator.getUserMedia ||
//	navigator.webkitGetUserMedia ||
//	navigator.mozGetUserMedia ||
//	navigator.msGetUserMedia);
//
//navigator.getMedia({video:true, audio:true}, function(stream) {
//	ownPC.addStream(stream);
//	attachMediaStream(ownVideo, stream);
//	ownVideo.play();
//}, error);
//var iceStuff = false;
//
//createOffer = function() {
//	ownPC.createOffer(function(offer) {
//		ownPC.setLocalDescription(offer, function() {
//			ownOffer = offer;
//			console.log("ownOffer: " + encode(offer));
//		}, error);
//	}, error);
//};
//
//ownPC.onaddstream = function(stream) {
//	console.log("added Stream: ", stream);
//	globalStream = stream.stream;
//	attachMediaStream(remoteVideo, stream.stream);
//};
//
//ownPC.onicecandidate = function(event) {
//	var candidate = event.candidate;
//	if(candidate) {
//		ownPC.addIceCandidate(candidate);
//		obj = {
//			targetUser:'target-user-id',
//			candidate:candidate
//		};
//	}
//};
//onReceiveRTCDescription = function(offer) {
//	ownPC.setRemoteDescription(new RTCSessionDescription(offer));
//	ownPC.createAnswer(function(answer) {
//		ownPC.setLocalDescription(answer, function() {
//			ownOffer = answer;
//			console.log("answer: " + encode(answer));
//		}, error);
//	}, error);
//};
//
//onReceiveRTCAnswer = function(answer) {
//	ownPC.setRemoteDescription(new RTCSessionDescription(answer), function(msg) {
//		console.log("msg:", msg);
//	});
//}
//
function decode(msg) {
	return JSON.parse(atob(msg));
}

function encode(msg) {
	return btoa(JSON.stringify(msg));
}
//
//function error(err) {
//	console.log("Error: ", err);
//}





var vid1 = document.getElementById("vid1");
var vid2 = document.getElementById("vid2");
btn1.disabled = false;
btn2.disabled = true;
btn3.disabled = true;
var pc1,pc2;
var localstream;
var sdpConstraints = {'mandatory': {
	'OfferToReceiveAudio':true,
	'OfferToReceiveVideo':true }};

function gotStream(stream){
	trace("Received local stream");
	// Call the polyfill wrapper to attach the media stream to this element.
	attachMediaStream(vid1, stream);
	localstream = stream;
	btn2.disabled = false;
}

function start() {
	trace("Requesting local stream");
	btn1.disabled = true;
	// Call into getUserMedia via the polyfill (adapter.js).
	getUserMedia({audio:true, video:true},
		gotStream, function() {});
}

function call() {
	btn2.disabled = true;
	btn3.disabled = false;
	trace("Starting call");
	videoTracks = localstream.getVideoTracks();
	audioTracks = localstream.getAudioTracks();
	if (videoTracks.length > 0)
		trace('Using Video device: ' + videoTracks[0].label);
	if (audioTracks.length > 0)
		trace('Using Audio device: ' + audioTracks[0].label);
	var servers = null;
	pc1 = new RTCPeerConnection(servers);
	trace("Created local peer connection object pc1");
	pc1.onicecandidate = iceCallback1;
	pc1.onaddstream = gotRemoteStream;
	pc2 = new RTCPeerConnection(servers);
	trace("Created remote peer connection object pc2");
	pc2.onicecandidate = iceCallback2;
	pc2.onaddstream = gotRemoteStream;

	pc1.addStream(localstream);
	trace("Adding Local Stream to peer connection");

	pc1.createOffer(gotDescription1, null, null);
}

function gotDescription1(desc){
	pc1.setLocalDescription(desc);
	trace("Offer from pc1 \n" + desc.sdp);
	//pc2.setRemoteDescription(desc);
	// Since the "remote" side has no media stream we need
	// to pass in the right constraints in order for it to
	// accept the incoming offer of audio and video.
	//pc2.createAnswer(gotDescription2, null, sdpConstraints);
	console.log("desc: ", encode(desc));
	console.log("You have to use this in pc2.setRemoteDescription + createAnswer");

}

function gotDescription2(desc){
	pc1.setLocalDescription(desc);
	console.log("answer: ", encode(desc));
	trace("Answer from pc2 \n" + desc.sdp);
	//pc1.setRemoteDescription(desc);
}

function hangup() {
	trace("Ending call");
	pc1.close();
	pc2.close();
	pc1 = null;
	pc2 = null;
	btn3.disabled = true;
	btn2.disabled = false;
}

function gotRemoteStream(e){
	// Call the polyfill wrapper to attach the media stream to this element.
	attachMediaStream(vid2, e.stream);
	trace("Received remote stream");
}

function iceCallback1(event){
	if (event.candidate) {
		//pc2.addIceCandidate(new RTCIceCandidate(event.candidate));
		trace("Local ICE candidate: \n" + event.candidate.candidate);
	}
}

function iceCallback2(event){
	if (event.candidate) {
		pc1.addIceCandidate(new RTCIceCandidate(event.candidate));
		trace("Remote ICE candidate: \n " + event.candidate.candidate);
	}
}

function trace(text) {
	// This function is used for logging.
	if(text[text.length - 1] == '\n') {
		text = text.substring(0, text.length - 1);
	}
	console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}