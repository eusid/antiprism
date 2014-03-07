/**
 * client.js
 *
 * Chatclient for Project Antiprism using the antiprismSDK
 * -------------------------------------------------------
 *
 * ideas for features:
 * -------------------
 *
 *    - "is writing"-support
 *
 *    - use webrtc (P2P):
 *            - videochat
 *            - datachannel (filetransferring)
 *            - temporary chatsession(?)
 *
 */


var enableWebRTC = navigator.userAgent.indexOf("Chrome") !== -1,
	cache = {pubkeys:{}, requests:{}},
	helper = {
		clearStorageUserdata:function() {
			var muted = localStorage.getObject("muted");
			sessionStorage.clear();
			localStorage.clear();
			localStorage.setObject("muted", muted);
		},
		addStorageObjectFunctions:function() {
			Storage.prototype.setObject = function(key, value) {
				this.setItem(key, JSON.stringify(value));
			};

			Storage.prototype.getObject = function(key) {
				var value = this.getItem(key);
				try {
					value = JSON.parse(value);
				} catch(e) { }
				return value;
			};
		},
		lineBreak:function() {
			return document.createElement("br");
		},
		h4:function(headline) {
			var h4 = document.createElement("h4");
			h4.innerHTML = utils.htmlEncode(headline);
			return h4;
		},
		p:function(text) {
			var p = document.createElement("p");
			p.innerHTML = utils.htmlEncode(text);
			return p;
		},
		div:function(className) {
			var div = document.createElement("div");
			div.className = className || "";
			return div;
		},
		span:function(className, value) {
			var span = document.createElement("span");
			span.className = className || "";
			span.innerHTML = value || "";
			return span;
		},
		input:function(type, name) {
			var input = document.createElement("input");
			input.type = type;
			input.className = "form-control";
			input.id = name || "";
			input.placeholder = name || "";
			return input;
		},
		a:function(linkName, location) {
			var a = document.createElement("a");
			a.innerHTML = linkName;
			a.href = location;
			return a;
		},
		small:function(innerHTML) {
			var small = document.createElement("small");
			if(innerHTML === undefined)
				innerHTML = "";
			small.innerHTML = innerHTML;
			return small;
		},
		button:function(value, className, clickEvent) {
			var button = document.createElement("button");
			button.className = className || "";
			button.innerHTML = value || "";
			button.type = "button";
			if(clickEvent)
				button.onclick = clickEvent;
			return button;
		},
		ul:function(className) {
			var ul = document.createElement("ul");
			ul.className = className || "";
			return ul;
		},
		li:function(className) {
			var li = document.createElement("li");
			li.className = className || "";
			return li;
		},
		option:function(optionName) {
			var option = document.createElement("option");
			option.value = optionName;
			option.innerHTML = optionName;
			return option;
		},
		select:function(optionsArray) {
			var select = document.createElement("select"), i, option;
			select.className = "form-control";
			for(i in optionsArray) {
				if(optionsArray.hasOwnProperty(i)) {
					option = helper.option(optionsArray[i]);
					select.appendChild(option);
				}
			}
			return select;
		},
		form:function(className) {
			var form = document.createElement("form");
			form.role = "form";
			form.className = className || "";
			return form;
		},
		jsLink:function(linkName, clickEvent) {
			var jsLink = helper.a(linkName, "#");
			if(clickEvent)
				jsLink.onclick = clickEvent;
			jsLink.className = "jsLink";
			return jsLink;
		},
		glyphicon:function(name) {
			return helper.div("glyphicon glyphicon-" + name);
		}
	},

	errorHandler = function(errorType, errorMsg, errorCode) { //You can call it with errorType and errorMessage or with an errorcode
		var error = {type:errorType || "Error", msg:errorMsg || "Unknown Error."},
			getErrorByCode = function(errorCode) { //TODO change errortext
				var error = {type:"Error", msg:""};
				switch(errorCode) {
					case 1:
						error.msg = "Missing action parameter.";
						break;
					case 2:
						error.msg = "Action does not exist.";
						break;
					case 3:
						error.msg = "Invalid action parameters.";
						break;
					case 4:
						error.msg = "JSON parse error.";
						break;
					case 5:
						error.msg = "Invalid authentication-key";
						break;
					case 6:
						error.msg = "Tried to access unknown user.";
						break;
					case 7:
						error.msg = "Requested pubkey does not exist.";
						break;
					case 8:
						error.msg = "Requested action is not permitted.";
						break;
					default:
						error.msg = "Unknown Error.";
						break;
				}

				return error;
			},
			displayError = function(error) {
				console.error("An error occured: ", error);
				var errorContainer = helper.div("alert alert-danger fade in"),
					closeButton = helper.button("x", "close"),
					headline = helper.h4(error.type),
					errorMessage = helper.p(error.msg);
				closeButton.setAttribute("data-dismiss", "alert");
				closeButton.setAttribute("aria-hidden", true);
				errorContainer.appendChild(closeButton);
				errorContainer.appendChild(headline);
				errorContainer.appendChild(errorMessage);
				errorContainer.id = "alertError";
				$('#headline').append(errorContainer);
				$('#alertError').hide().slideDown(200).delay(3000).fadeOut(1000, function() {
					$('#alertError').remove();
				});
			};
		if(!isNaN(errorCode))
			error = getErrorByCode(errorCode);
		displayError(error);
	},

	antiprism,
	utils = {
		setHeadline:function(msg) {
			var $h1 = $('h1'),
				statusMsg = helper.small();
			statusMsg.id = "statusMsg";
			$(statusMsg).click(utils.statusPrompt);
			$h1.text(headline + " (" + utils.getUsername() + ") ");
			$h1.append(statusMsg);
			if(msg.status === null)
				msg.status = "Set your status now! (Click here)";
			$('#statusMsg').text(msg.status).html();

		},
		switchToChat:function(showChat, time) { //showChat - boolean true if chat shall be shown
			var $login = $('#loginContainer'),
				chatActive = $login.attr("style") && $login.attr("style").indexOf("display: none;") !== -1;
			if((chatActive != showChat) && showChat !== undefined) {

				time = time === 0 ? time : time || 1000;
				$login.toggle(time);
				$('#chat').fadeToggle(time);
				$('#settings').fadeToggle(time);
			}
		},
		changeButton:function() {
			if(utils.register()) {
				$('#signInButton').text("Sign Up");
			} else {
				$('#signInButton').text("Sign In");
			}
		},
		muted:function() {
			var obj = localStorage.getObject("muted");
			if(obj === null) {
				localStorage.setObject("muted", false);
				obj = false;
			}
			return obj;
		},
		setMuteTooltip:function() {
			var msg;
			if(utils.muted())
				msg = "Sounds are off";
			else
				msg = "Sounds are on";
			$('#mute').tooltip().attr("title", msg);
		},
		setMuteButton:function() {
			var container = helper.div("btn-group"),
				button = helper.button("", "btn btn-default", function() {
					utils.changeMuteButton();
				}),
				on = "volume-up",
				off = "volume-off",
				glyphicon = helper.glyphicon(utils.muted() ? off : on);
			glyphicon.id = "muteIcon";
			button.id = "mute";
			button.innerHTML = "mute ";
			button.appendChild(glyphicon);
			container.appendChild(button);
			$('#settings').append(container);
		},
		changeMuteButton:function(newValue) {
			var $muteIcon = $('#muteIcon'),
				on = "glyphicon-volume-up",
				off = "glyphicon-volume-off";
			if(newValue === undefined) {
				if(utils.muted()) {
					$muteIcon.removeClass(off).addClass(on);
					localStorage.muted = "false";
				} else {
					$muteIcon.removeClass(on).addClass(off);
					localStorage.muted = "true";
				}
			} else if(newValue === "true") {
				$muteIcon.removeClass(on).addClass(off);
			} else if(newValue === "false") {
				$muteIcon.removeClass(off).addClass(on);
			}
			utils.setMuteTooltip();
		},
		changePasswordValidated:function() {
			return $('#newPassField').val() === $('#newPassFieldCheck').val();
		},
		hideChangePasswordDialog:function() {
			$('#newPassField').val("");
			$('#newPassFieldCheck').val("");
			$('#changePass').modal('hide');
		},
		htmlEncode:function(value) {
			return $('<div/>').text(value).html();
		},
		getUsername:function() {
			return localStorage.username || $('#username').val();
		},
		getPassword:function() {
			return localStorage.password || $('#password').val();
		},
		messageDisplay:function() {
			return $('#messages');
		},
		register:function() {
			return $('#registration').prop('checked');
		},
		rememberMe:function() {
			return localStorage.getObject("rememberUser") || $('#rememberMe').prop('checked');
		}, setOnClickEvents:function() {
			document.getElementById('registration').onclick = utils.changeButton;
			document.getElementById('rememberMe').onclick = utils.rememberMePrompt;
			document.getElementById('signInButton').onclick = function() {
				client.login();
			};
			document.getElementById('addFriendButton').onclick = client.addFriend;
			document.getElementById('sendButton').onclick = client.sendMessage;
			document.getElementById('logout').onclick = client.logout;
			document.getElementById('savePassButton').onclick = client.changePass;
			document.getElementById('updateContactsButton').onclick = client.getContacts;
			document.getElementById('removeContactButton').onclick = utils.removeContactPrompt;
			document.getElementById('createGroup').onclick = utils.createGroupPrompt;
			document.getElementById('inviteToGroup').onclick = utils.groupInvitePrompt;
			document.getElementById('setStatusButton').onclick = utils.statusPrompt;
			document.getElementById('getMember').onclick = utils.getMembersPrompt;
			document.getElementById('reconnectButton').onclick = function() {
				antiprism.reconnect();
				$('#serverLost').modal('hide');
			};
		},
		rememberMePrompt:function() {
			if(utils.rememberMe()) {
				bootbox.dialog({
					message:"Only check this when you are completely sure that no one else is using this computer.\n" +
						"Are you the only one with access to this browser?",
					title:"Attention",
					buttons:{
						success:{
							label:"Yes, I am.",
							className:"btn-success",
							callback:function() {
							}
						},
						danger:{
							label:"No, I am not.",
							className:"btn-danger",
							callback:function() {
								$('#rememberMe').prop("checked", false);
							}
						}
					}
				});
			}
		},
		statusPrompt:function() {
			bootbox.prompt("What's up?", utils.statusPromptCallback);
		},
		statusPromptCallback:function(result) {
			var maxLength = 75;
			if(result !== null) {
				if(result.length > maxLength) {
					bootbox.prompt("Unfortunately your status was too long. :(\n" +
						"Allowed are " + maxLength + ", you entered " + result.length + ". " +
						"Anyway, what's on your mind?", utils.statusPromptCallback);
				} else {
					client.setStatus(result);
				}
			}
		},
		addKeyEvents:function() {
			$('#login').find(".textField").keyup(function(e) {
				if(e.keyCode === 13) {
					client.login();
				}
			});
			$('#messageField').keyup(function(e) {
				if(e.keyCode === 13) {
					client.sendMessage();
				}
			});
			$('#addFriendField').keyup(function(e) {
				if(e.keyCode === 13) {
					client.addFriend();
				}
			});
			$('#newPassFieldCheck').keyup(function() {
				function validate() {
					var $div = $('#changePassContainer');
					if(!utils.changePasswordValidated()) {
						$div.addClass("has-error");
						$div.removeClass("has-success");
						$('#savePassButton').prop("disabled", true);
					} else {
						$div.removeClass("has-error");
						$div.addClass("has-success");
						$('#savePassButton').prop("disabled", false);
					}
				}

				validate();
				$('#newPassField').keyup(validate);
			});
		},
		getContactList:function() {
			var contactlist = $('a[class="list-group-item"]').splice(1),
				contactNames = [], contact, name;
			for(contact in contactlist) {
				if(contactlist.hasOwnProperty(contact)) {
					name = contactlist[contact].id;
					contactNames.push(name);
				}
			}
			return contactNames;
		},
		removeContactPrompt:function() {
			bootbox.prompt("What Contact do you want to remove?", function(result) {
				if(result !== null) {
					var firstResult = result;
					bootbox.confirm("Are you sure that you want to remove " + result + "?", function(result) {
						if(result)
							antiprism.removeContact(firstResult, client.getContacts);
					});
				}
			});
			$('.bootbox-input').addClass("typeahead").attr("placeholder", "Friend to remove");
			var dataSource = utils.getContactList();

			$('.typeahead').typeahead({
				local:dataSource,
				items:4,
				minLength:1
			});
			$('.tt-hint').remove();
		},
		getMembersPrompt:function() {
			var dataSource = utils.getContactList(),
				groups = [];
			for(var i = 0; i < dataSource.length; i++) {
				if(dataSource[i][0] === '$')
					groups.push(dataSource[i].substring(1));
			}
			bootbox.prompt("From which group do you want to see a list of users?", function(result) {
				if(result !== null) {
					antiprism.getMembers("$" + result, function(members) {
						var msgStr = "<table>";
						for(var i = 0; i < members.length; i++) {
							msgStr += "<tr><td>" +
								utils.htmlEncode(members[i]) +
								"</td></tr>";
						}
						msgStr += "</table>";
						bootbox.dialog({
							message:msgStr,
							title:"Members of " + utils.htmlEncode(result),
							buttons:{
								main:{
									label:"Got it, thanks",
									className:"btn-primary"
								}
							}
						});
					});
				}
			});
			$('.bootbox-input').addClass("typeahead").attr("placeholder", "Groupname");
			$('.typeahead').typeahead({
				local:groups,
				items:4,
				minLength:1
			});
			$('.tt-hint').remove();
		},
		createGroupPrompt:function() {
			bootbox.prompt("Type a name for your group", function(result) {
				if(result !== null) {
					antiprism.createGroup('$' + result, client.getContacts);
				}
			});
		},
		groupInvitePrompt:function() {
			var dataSource = utils.getContactList(),
				groups = [], contacts = [];
			for(var i = 0; i < dataSource.length; i++) {
				if(dataSource[i][0] === '$')
					groups.push(dataSource[i].substring(1));
				else
					contacts.push(dataSource[i]);
			}
			bootbox.prompt("To which group shall the user been added?", function(result) {
				if(result !== null) {
					var groupName = result;
					bootbox.prompt("Which contact do you want to add to " + utils.htmlEncode(result) + "?", function(result) {
						if(result !== null)
							antiprism.invite('$' + groupName, result, antiprism.debug());
					});
					$('.bootbox-input').addClass("typeahead").attr("placeholder", "Contactname");
					$('.typeahead').typeahead({
						local:contacts,
						items:4,
						minLength:1
					});
					$('.tt-hint').remove();
				}
			});
			$('.bootbox-input').addClass("typeahead").attr("placeholder", "Groupname");
			$('.typeahead').typeahead({
				local:groups,
				items:4,
				minLength:1
			});
			$('.tt-hint').remove();
		},
		createContactElement:function(contact, msg) {
			var contactElement = helper.jsLink(""),
				icon = helper.span("online"),
				status = helper.small();
			contactElement.className = "list-group-item";
			contactElement.appendChild(icon);
			contactElement.innerHTML += utils.htmlEncode(contact);
			contactElement.id = contact;
			contactElement.addEventListener("click", function(ctx) {
				var contactName = ctx.target.id || ctx.target.parentNode.id;
				utils.onContactSelect(contactName);
			});
			if(msg.contacts[contact] && msg.contacts[contact].status !== null)
				status.innerHTML = emotify ? emotify(utils.htmlEncode(msg.contacts[contact].status)) : utils.htmlEncode(msg.contacts[contact].status);
			else
				status.innerHTML = "";
			contactElement.appendChild(status);
			return contactElement;
		},
		appendContactElement:function(contacts, msg, contactListDOM) {
			for(var contact in contacts) {
				var contactElement = utils.createContactElement(contacts[contact], msg);
				contactListDOM.appendChild(contactElement);
			}
		},
		displayContacts:function(msg) {
			if(msg && msg.error)
				errorHandler(0, 0, msg.error);
			console.log(msg);
			var $friendList = $('#friendList'),
				contactList = helper.div("list-group"),
				contactsHeadline = helper.jsLink("<strong>Contactlist</strong>"),
				$active = $('.active');
			contactsHeadline.className = "list-group-item";
			contactsHeadline.id = "contactsHeadline";
			contactList.appendChild(contactsHeadline);
			utils.appendContactElement(Object.keys(msg.contacts), msg, contactList);
			utils.appendContactElement(msg.requests.to, msg, contactList);
			utils.appendContactElement(msg.requests.from, msg, contactList);
			if($active.length)
				var formerSelectedContact = $active[0].id;
			$friendList.text("");
			$friendList.append(contactList);
			for(var contact in msg.contacts) {
				if(msg.contacts.hasOwnProperty(contact))
					utils.displayOnline({user:contact, online:msg.contacts[contact].online});
			}
			for(var i in msg.requests.to) {
				utils.displayOnline({user:msg.requests.to[i], online:false, request:true});
			}
			for(i in msg.requests.from)
				utils.displayOnline({user:msg.requests.from[i], online:false, request:true, confirmed:false});
			if(formerSelectedContact)
				$(document.getElementById(formerSelectedContact)).addClass("active");
			if(msg.requests === undefined)
				msg.requests = [];
			utils.addFriendsPopover(Object.keys(msg.contacts).length + msg.requests.from.length + msg.requests.to.length);
		},
		displayRetrieveMoreMessagesButton:function(contactName) {
			console.log("displaying retrieveMoreMessagesButton...");
			var container = helper.div("col-md-12");
			var button = helper.button("Retrieve More Messages", "btn btn-info btn-sm btn-block", function() {
				utils.retrieveMessages(contactName);
			});
			button.id = "retrieveMoreMessagesButton";
			button.disabled = "true";
			container.id = "retrieveMoreMessages";
			container.appendChild(button);
			utils.messageDisplay().append(container);
			utils.disableRetrieveMoreMessagesButton(contactName);
		},
		disableRetrieveMoreMessagesButton:function(contactName) {
			var obj = {msglist:[]},
				disableButton = function() {
					obj = sessionStorage.getObject(contactName);
					if(!obj.msglist)
						obj.msglist = [];
					$('#retrieveMoreMessagesButton')[0].disabled = obj.msglist.length >= obj.numberOfMessages;
				};
			if(!sessionStorage[contactName]) {
				console.log("disableRetrieveMoreMessagesButton is called and sessionStorage[\"" + contactName + "\"] does not exist");
				utils.updateContactObject(contactName, disableButton);
				return;
			}
			disableButton();
			if(!obj || (obj.msglist.length === 0 && obj.numberOfMessages > 0)) {
				console.log("disableRetrieveMoreMessagesButton has not enough displayed messages");
				utils.updateContactObject(contactName, disableButton, obj.numberOfMessages);
			}
		},
		retrieveMessages:function(contactName) {
			if(sessionStorage[contactName]) {
				var userObj = sessionStorage.getObject(contactName);
				if(userObj.numberOfMessages > userObj.msglist.length) {
					var diff = userObj.numberOfMessages - userObj.msglist.length;
					if(diff > 10)
						diff = 10;
					antiprism.getMessages(contactName, (0 - userObj.msglist.length - diff),
						(-1 - userObj.msglist.length), function(msg) {
							utils.addMessagesToStorage(contactName, msg.msglist, true);
							msg.msglist = msg.msglist.reverse();
							utils.displayMessages(msg, contactName, true);
						});
				}
			}
			else {
				console.log("retrieveMessages is called and has no sessionStorage[\"" + contactName + "\"]!");
				utils.updateContactObject(contactName, function() {
					utils.retrieveMessages(contactName);
				});
			}
		},
		addFriendsPopover:function(contactLength) {
			if(!contactLength && contactLength !== undefined) {
				var $addFriendField = $('#addFriendField');
				$addFriendField.popover({content:"Add some friends now!", trigger:"manual", placement:"top"});
				$addFriendField.popover("show");
				$addFriendField.focus(function() {
					$addFriendField.popover("hide");
				});
				$addFriendField.focusout(function() {
					$addFriendField.popover("show");
				});
			}
			else {
				$('#addFriendField').unbind("focus").unbind("focusout");
			}
		},
		updateContactObject:function(contactName, callback, numberOfMessages) {
			if(numberOfMessages === undefined) {
				// this querying-global is the dirtiest piece of shit ever
				// time to fix the loop-bug that occurs without it!
				antiprism.countMessages(contactName, function(msg) {
					if(msg && msg.error)
						errorHandler(0, 0, msg.error);
					utils.updateContactObject(contactName, callback, msg.msgcount);
				});
				return;
			}
			var oldObj = sessionStorage.getObject(contactName);
			var msglist = [];
			if(oldObj)
				msglist = oldObj.msglist;
			var obj = {numberOfMessages:numberOfMessages, msglist:msglist};
			sessionStorage.setObject(contactName, obj);
			if(callback)
				callback();
		},
		onContactSelect:function(contactName) {
			var $contactNode = $(document.getElementById(contactName)),
				$active = $('.active'),
				userObj = sessionStorage.getObject(contactName),
				iconClass = $contactNode.children()[0].className;
			if($active.length)
				$active.removeClass("active");
			$contactNode.addClass("active");
			$contactNode.removeClass("newMessage");
			utils.messageDisplay().empty();
			utils.updateContactObject($contactNode[0].id, function() {
				if((iconClass.indexOf("glyphicon-user") !== -1) || (iconClass.indexOf("glyphicon-th") !== -1)) {
					utils.displayRetrieveMoreMessagesButton(contactName);
					client.getMessages(contactName);
				}
			});
			if(iconClass.indexOf("glyphicon-time") !== -1) {
				utils.displayMessage({from:contactName, msg:"Waiting for confirmation by user.", ts:(new Date()).getTime()}, contactName, false);
			} else if(iconClass.indexOf("glyphicon-question-sign") !== -1)
				utils.displayMessage({from:contactName, msg:"This user sent you a friendrequest. To confirm please click the button below.", ts:(new Date()).getTime(), request:true}, contactName, false);
		},
		urlToLink:function(message) {
			var urlregex = /(\b(https?):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig,
				results = message.match(urlregex);
			for(var link in results) {
				if(results.hasOwnProperty(link)) {
					var replaced = message.replace(results[link], results[link].link(results[link]));
					message = replaced.replace("<a", "<a target=_blank");
				}
			}
			return message;
		},
		onMessage:function(msg) {
			var sender = msg.from || msg.to,
				isGroup = msg.to && msg.to[0] === '$';
			if(msg && msg.error)
				errorHandler(0, 0, msg.error);
			var userObj = sessionStorage.getObject(sender);
			if(!userObj) {
				utils.updateContactObject(sender, function() {
					utils.onMessage(msg);
				});
				return;
			}
			var $active = $('.active'),
				selected = null;
			if($active.length)
				selected = $active[0].id;
			if(!msg.to && (sender !== selected || !document.hasFocus())) {
				if(!utils.muted())
					utils.playSound("ios.mp3");
			}
			utils.pushOneMessageToStorage(sender, msg);
			utils.displayMessage(msg, isGroup ? msg.to : sender);
		},
		displayMessageContent:function(message, contactName, moreMessages) {
			var panelContainer = helper.div("panel col-md-8"),
				panelHeader = helper.div("panel panel-heading"),
				panelContent = helper.div("panel panel-body"),
				img = document.createElement("img"),
				username = message.from || utils.getUsername(),
				time = new Date(message.ts),
				receivedMessage = utils.htmlEncode(message.msg);
			img.width = 18;
			if(cache.pubkeys[username])
				MonsterId.getAvatar(cache.pubkeys[username], img);
			else if(!cache.requests[username]) {
				cache.requests[username] = [img];
				antiprism.getPubkey(username, function(pubkey) {
					cache.pubkeys[username] = pubkey;
					for(var img in cache.requests[username])
						MonsterId.getAvatar(cache.pubkeys[username], cache.requests[username][img]);
				});
			}
			else
				cache.requests[username].push(img);
			panelContent.innerHTML = emotify ? emotify(utils.urlToLink(receivedMessage)) : utils.urlToLink(receivedMessage);
			if(time.toDateString() !== (new Date()).toDateString())
				time = time.toDateString() + ", " + time.toLocaleTimeString();
			else
				time = "today, " + time.toLocaleTimeString();
			if(username === utils.getUsername()) {
				var text = document.createElement("span");
				text.innerText = time + " | me ";
				panelContainer.className += " panel-success pull-right";
				panelHeader.appendChild(text);
				panelHeader.appendChild(img);
				panelContent.align = "right";
				panelHeader.align = "right";
			} else {
				var text = document.createElement("span");
				text.innerText = " " + username + " | " + time;
				panelContainer.className += " panel-info";
				panelHeader.appendChild(img);
				panelHeader.appendChild(text);
			}
			panelContainer.appendChild(panelHeader);
			panelContainer.appendChild(panelContent);
			if(moreMessages)
				$('#retrieveMoreMessages').after(panelContainer);
			else
				utils.messageDisplay().append(panelContainer);
			if(message.request) {
				var confirmButtonDiv = utils.createConfirmDenyButton(contactName);
				panelContent.appendChild(confirmButtonDiv);
			}
		},
		displayMessage:function(message, contactName, chained, moreMessages) {
			var $active = $('.active');
			var selectedContact = "";
			if(!document.hasFocus())
				$('title').text("#AP - " + contactName + " just contacted you!");
			if($active.length)
				selectedContact = $active[0].id;
			if(selectedContact === contactName) {
				utils.displayMessageContent(message, contactName, moreMessages);
				if(!chained)
					utils.animateDisplay();
			} else {
				$(document.getElementById(contactName)).addClass("newMessage");
			}
		},
		animateDisplay:function() {
			utils.messageDisplay().animate({ scrollTop:utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
		},
		createConfirmDenyButton:function(contactName) {
			var buttonDiv = helper.div("col-md-12"),
				confirmButton = helper.button("Confirm " + utils.htmlEncode(contactName), "btn btn-success", function() {
					antiprism.confirm(contactName, function(ack) {
						if(ack.error)
							errorHandler(0, 0, msg.error);
						if(ack) {
							utils.messageDisplay().empty();
							client.getContacts();
						}
					});
				}),
				denyButton = helper.button("Deny " + utils.htmlEncode(contactName), "btn btn-danger pull-right", function() {
					bootbox.confirm("Are you sure you want to remove " + utils.htmlEncode(contactName) +
						"? You can send a new Request if you want to add him later, though.", function(confirmed) {
						if(confirmed)
							antiprism.deny(contactName, function(ack) {
								if(ack.error)
									errorHandler(0, 0, msg.error);
								if(ack) {
									utils.messageDisplay().empty();
									client.getContacts();
								}
							});
					});
				});
			buttonDiv.appendChild(helper.lineBreak());
			buttonDiv.appendChild(confirmButton);
			buttonDiv.appendChild(denyButton);
			return buttonDiv;
		},
		pushOneMessageToStorage:function(contactname, msg) {
			var userObj = sessionStorage.getObject(contactname);
			userObj.msglist.push(msg);
			userObj.numberOfMessages++;
			sessionStorage.setObject(contactname, userObj);
		},
		addMessagesToStorage:function(contactname, msglist, tail) {  //tail: boolean (if true then the received messages are received by "receiveMoreMessagesButton")
			var userObj = sessionStorage.getObject(contactname);
			if(tail) {
				msglist = msglist.concat(userObj.msglist);
				userObj.msglist = msglist;
			} else
				userObj.msglist = msglist;
			sessionStorage.setObject(contactname, userObj);
		},
		displayOnline:function(msg) {
			console.log("displayOnline: msg = ", msg);
			var isGroup = msg.user[0] === '$';
			if(msg && msg.error)
				errorHandler(0, 0, msg.error);
			var userIcon = document.getElementById(msg.user);
			if(userIcon) {
				userIcon = userIcon.children;
				if(userIcon.length > 0) {
					var className = "glyphicon  glyphicon-";
					if(msg.confirmed === false) {
						className += "time";
					} else if(msg.request) {
						className += "question-sign";
					} else {
						if(isGroup)
							className += "th";
						else if(msg.online)
							className += "user online";
						else
							className += "user";

					}
					userIcon[0].className = className;
				}
			}
		},
		displayMessages:function(msg, contactName, moreMessages) {
			for(var i in msg.msglist) {
				if(msg.msglist.hasOwnProperty(i))
					utils.displayMessage(msg.msglist[i], contactName, true, moreMessages);
			}
			if(!moreMessages)
				utils.animateDisplay();
			utils.disableRetrieveMoreMessagesButton(contactName);
		},
		playSound:function(mp3) {
			var sound = new Audio();
			sound.src = sound.canPlayType("audio/mpeg") ? mp3 : console.log("BING - you have got a new message!"); //TODO fallback einrichten
			sound.play();
		}
	},

	client = {
		init:function() {
			utils.addKeyEvents();
			utils.setOnClickEvents();
			utils.setMuteButton();
			utils.setMuteTooltip();
			window.addEventListener("storage", function(storageEvent) {
				console.log(storageEvent);
				if(storageEvent.key == "muted" && storageEvent.url == document.URL)
					utils.changeMuteButton(storageEvent.newValue);
			}, true);
		},
		lostConnection:function(reconnected) {
			if(reconnected.error)
				errorHandler(0, 0, reconnected.error);
			if(reconnected)
				for(var userObj in sessionStorage) {
					if(sessionStorage.hasOwnProperty(userObj)) {
						var obj;
						try {
							obj = sessionStorage.getObject(userObj);
						} catch(e) {
							continue;
						}
						obj.numberOfMessages = undefined;
						sessionStorage.setObject(userObj, obj);
					}
				}
			else if(antiprism)
				$('#serverLost').modal();
		},
		getContacts:function(msg) {
			if(msg && msg.error)
				errorHandler(0, 0, msg.error);
			antiprism.getContacts(utils.displayContacts);
		},
		getMessages:function(contactName, start, end) {
			var userObj = sessionStorage.getObject(contactName) || {msglist:[]};
			if(!userObj) {
				console.log("getMessages was called and it has no sessionstorage[\"" + contactName + "\"]!");
				utils.updateContactObject(contactName, function() {
					client.getMessages(contactName, start, end);
				});
				return;
			} else if(userObj.msglist && userObj.msglist.length >= 10) {
				utils.displayMessages(userObj, contactName);
				console.log("displayed messages from sessionstorage");
				return;
			}
			start = (start === undefined) ? -10 : start;
			end = (end === undefined) ? -1 : end;
			antiprism.getMessages(contactName, start, end, function(msg) {
				if(msg && msg.error)
					errorHandler(0, 0, msg.error);
				utils.addMessagesToStorage(contactName, msg.msglist);
				utils.displayMessages(msg, contactName);
			});
		},
		sendMessage:function(temporary) {
			var $messageField = $('#messageField');
			var message = $messageField.val();
			if(!message)
				return;
			var to = null;
			var $active = $('.active');
			if($active.length)
				to = $active[0].id;
			if(to)
				antiprism.sendMessage(to, message, function(msg) {
					if(msg && msg.error)
						errorHandler(0, 0, msg.error);
					$messageField.val('');
					var sentMessage = {to:to, ts:msg.ts, msg:message};
					utils.pushOneMessageToStorage(to, sentMessage);
					utils.displayMessage(sentMessage, to);
				}, temporary);
			else {
				utils.displayMessage({to:null, ts:(new Date()).getTime(), msg:"You didn\'t choose a contact!"});
			}
		},
		changePass:function() {
			if(utils.changePasswordValidated()) {
				var $passwordField = $('#newPassField');
				antiprism.changePassword($passwordField.val());
				$('#changePassContainer').removeClass("has-success");
				$passwordField.unbind("keyup");
				utils.hideChangePasswordDialog();
			}
		},
		setStatus:function(statusMsg) {
			antiprism.setStatus(statusMsg, function(msg) {
				if(msg && msg.error)
					errorHandler(0, 0, msg.error);
				utils.setHeadline({status:statusMsg});
			});
		},
		addFriend:function() {
			var $friendField = $('#addFriendField'),
				friend = $friendField.val();
			if(!friend)
				return;
			antiprism.initConversation(friend, function(msg) {
				if(msg && msg.error)
					errorHandler(0, 0, msg.error);
				$friendField.val("");
				if(msg.initiated)
					client.getContacts();
				else {
					var errorType = "Contact Error",
						errorMsg = "Did not initiate conversation with " + utils.htmlEncode(friend) + ". You may already added him or he may not exist.";
					errorHandler(errorType, errorMsg);
				}
			});
		},
		login:function(username, password, restored) {
			username = username || utils.getUsername();
			password = password || utils.getPassword();
			var registration = utils.register(),
				host = location.origin.replace(/^http/, 'ws');
			$("#loadingBar").slideToggle(300);
			//$('#loginForm').prop("disabled", true); //todo
			antiprism = new Antiprism(host, true); // params: host,[debugFlag]
			var callback = function(msg) {
				$("#loadingBar").hide();
				if(msg) {
					if(msg && msg.error)
						errorHandler(0, 0, msg.error);
					utils.switchToChat(true, restored ? 400 : undefined);
					client.getContacts();
					antiprism.getStatus(function(msg) {
						if(msg && msg.error)
							errorHandler(0, 0, msg.error);
						utils.setHeadline(msg);
					});
					//Ask before user leaves the page
					if(!utils.rememberMe())
						$(window).bind("beforeunload", function(msg) {
							return "You will be logged out when you reload or close.";
						});
				} else {
					$('#loginAlert').fadeIn(1000, function() {
						setTimeout(function() {
							$('#loginAlert').fadeOut();
						}, 5000);
					});
				}
				$('#password').val("");
			};
			var messageCallback = utils.onMessage;
			if(enableWebRTC) {
				webRTC = new WebRTC(antiprism);
				messageCallback = function(msg) {
					if(msg.temp)
						webRTC.onMessage(msg);
					else
						utils.onMessage(msg);
				};
				$('#turnOnVideo').show().click(function() {
					webRTC.requestMedia();
					$('#startVideoChat').show().click(function() {webRTC.openConnection();});
					$('#displayOwnVideo').show().click(webRTC.displayOwnVideo);
				});
			}
			antiprism.addEventListener("msg", messageCallback);
			antiprism.addEventListener("closed", client.lostConnection);
			antiprism.addEventListener("error", errorHandler);
			antiprism.addEventListener("online", utils.displayOnline);
			antiprism.addEventListener("added", client.getContacts);
			if(restored)
				return antiprism.login(username, {hash:localStorage.password}, callback);
			if(registration)
				antiprism.register(username, password, function(msg) {
					if(msg && msg.error)
						errorHandler(0, 0, msg.error);
					antiprism.login(username, password, callback);
				});
			else {
				var storePass = function(hash) {
					localStorage.password = hash;
				}
				antiprism.login(username, password, callback, utils.rememberMe() ? storePass : undefined);
			}
			if(!localStorage.getObject("rememberUser") && utils.rememberMe()) {
				localStorage.setObject("rememberUser", true);
				localStorage.username = username;
			}
		},
		logout:function() {
			antiprism.close();
			antiprism = undefined;
			$('h1').text(headline);
			utils.messageDisplay().text("");
			utils.switchToChat(false);
			helper.clearStorageUserdata();
		}
	},

	debugHelper = {
		//Probably just available on chrome
		testTwoFunctions:function(firstFunction, secondFunction, calls) { //repeat: number of repititions - default is 10000
			calls = calls || 10000;
			var func = function(call) {
				for(var i = 0; i < calls; i += 2) call(i);
			};
			var start = window.performance.now();
			func(firstFunction);
			var first = window.performance.now() - start;
			start = window.performance.now();
			func(secondFunction);
			func(secondFunction);
			var second = window.performance.now() - start;
			start = window.performance.now();
			func(firstFunction);
			first += window.performance.now() - start;
			console.group("Testing results");
			console.log("First function needed " + first + "ms to perform " + calls + " calls. Second function needed " + second + "ms.");
			if(first > second) {
				console.log("The first function took " + (first - second) + "ms longer than the second function.");
				console.log("The second function is " + (first / second) + " times faster than the first function.");
				console.log("Mean saved time for one call by the second function: ~" + (first - second) / calls + "ms.");
			}
			else {
				console.log("The second function took " + (second - first) + "ms longer than the first function.");
				console.log("The first function is " + (second / first) + " times faster than the second function.");
				console.log("Mean saved time for one call by the first function: ~" + (second - first) / calls + "ms.");
			}
			console.groupEnd("Testing results");
			return {calls:calls, first:first, second:second};
		},
		testOneFunction:function(testFunc, calls, noLogs) {
			calls = calls || 10000;
			var func = function(call) {
				for(var i = 0; i < calls; i++) call(i);
			};
			var start = window.performance.now();
			func(testFunc);
			var time = window.performance.now() - start;
			if(!noLogs) {
				console.group("Testing results");
				console.log("The function needed " + time + "ms to perform " + calls + " calls.");
				console.log("That means it took ~" + time / calls + "ms per call.");
				console.log("If it runs constant the function can be called ~" + Math.floor(calls / time * 1000) + " times per second.");
				console.groupEnd("Testing results");
			}
			return {time:time, calls:calls};
		},
		determineCallsPerSecond:function(testFunc, calls) {  //calls - make calls bigger to make it more exactly.
			var meanCalls = 1,                                      // But remember: it takes per call about a second
				callTimes = [],
				calcMean = function(arr) {
					var sum = 0;
					for(var i = 0; i < arr.length; i++)
						sum += parseInt(arr[i]);
					return sum / arr.length;
				},
				calcMedian = function(arr) {
					arr.sort(function(a, b) {
						return a - b;
					});
					var half = Math.floor(arr.length / 2);
					if(arr.length % 2)
						return arr[half];
					else
						return Math.floor((arr[half - 1] + arr[half]) / 2.0);
				};
			for(var i = 0; i < calls; i++) {
				var res = debugHelper.testOneFunction(testFunc, meanCalls, true);
				callTimes.push(Math.floor(res.calls / res.time * 1000));
				meanCalls = calcMedian(callTimes);
			}
			console.log("Your Function can be called ~" + meanCalls + " times per second.");
			return meanCalls;
		},
		locustJS:function(username, numberOfLogins) { //password "penis" : "LE1UWGqxaR8loRB9NiW9AsBIfQmyXSK10fIThG2tIq4="
			var host = location.origin.replace(/^http/, 'ws'),
				connections = [],
				success = 0,
				password = {hash:atob("LE1UWGqxaR8loRB9NiW9AsBIfQmyXSK10fIThG2tIq4=")},
				i = 0,
				loginCallback = function(msg) {
					if(msg.loggedIn)
						success++;
					console.log("Successful logins: ", success);
				};
			for(; i < numberOfLogins; i++) {
				var antiprism = new Antiprism(host, true);
				antiprism.login(username, password, loginCallback);
				connections.push(antiprism);
			}

		}
	},
	WebRTC = function(antiprism) {
		var connection = null;

		// Handle messages received from the server
		this.onMessage = function(msg) {
			var message;
			try {
				message = JSON.parse(msg.msg);
			} catch(e) {
				errorHandler(null, null, 4);
				return;
			}
			switch(message.type) {
				// Respond to an offer
				case 'offer':
					connection.setRemoteDescription(new RTCSessionDescription(message));
					connection.createAnswer(function(sessionDescription) {
						connection.setLocalDescription(sessionDescription);
						antiprism.sendMessage(msg.from, JSON.stringify(sessionDescription), true);
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

		};

		//change STUN server if you don't trust google for requesting your public ip:port ;)
		//source: apprtc.appspot.com
		var cfg = {
			'iceServers':[
				{'url':'stun:stun.l.google.com:19302'},
				{'url':'turn:192.158.29.39:3478?transport=udp',
					'credential':'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
					'username':'28224511:1379330808'
				},
				{'url':'turn:192.158.29.39:3478?transport=tcp',
					'credential':'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
					'username':'28224511:1379330808'
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
				}), true);
			}
		};

		// Wire up the video stream once we get it
		connection.onaddstream = function(event) {
			//console.log("Stream added! ", this.encode(event.stream));
			var video = document.createElement("video");
			video.id = "remoteVideo";
			video.src = URL.createObjectURL(event.stream);
			video.autoplay = "autoplay";
			video.controls = "true";
			$('#messages').append(video);

		};
		this.requestMedia = function(callback) { // Ask for access to the video and audio devices
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

		this.getRPCConnection = function() {
			return connection;
		};

		// Kick off the negotiation with an offer request
		this.openConnection = function() {
			var to = null,
				$active = $('.active');
			if($active.length)
				to = $active[0].id;
			if(!connection.getLocalStreams().length) {
				this.requestMedia(this.openConnection);
				return;
			}
			connection.createOffer(function(sessionDescription) {
				connection.setLocalDescription(sessionDescription);
				antiprism.sendMessage(to, JSON.stringify(sessionDescription), true);
			});
		};

		this.displayOwnVideo = function() {
			var stream = connection.getLocalStreams()[0],
				video = document.createElement("video");
			video.src = URL.createObjectURL(stream);
			video.height = 320;
			video.width = 460;
			video.id = "localVideo";
			video.play();
			$('#messages').append(video);
		};

		this.decode = function(msg) {
			return JSON.parse(atob(msg));
		};

		this.encode = function(msg) {
			return btoa(JSON.stringify(msg));
		};
	};

$(document).ready(function() {
	helper.addStorageObjectFunctions();
	if(utils.rememberMe()) {
		document.getElementById("username").value = localStorage.username || "";
		document.getElementById("password").value = document.getElementById("username").value && "password";
		client.login(localStorage.username, localStorage.password, true);
	}
	else
		helper.clearStorageUserdata();
	client.init();
	$('form').submit(function(e) {
		e.preventDefault();
	});
});
