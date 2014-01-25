/**
 * client.js
 *
 * Chatclient for Project Antiprism using the antiprismSDK
 * -------------------------------------------------------
 *
 * ideas for features:
 * -------------------------
 *
 *    - Groupchat (wait for server implementation)
 *
 *    - error handling
 *
 *    - (port to firefox)
 *
 */

$(document).ready(function () {
    helper.addStorageObjectFunctions();
    client.init();
    $('form').submit(function (e) {
        e.preventDefault();
    });
});

var antiprism,
    utils = {
        firstLogin: false,
        setHeadline: function (msg) {
            var $h1 = $('h1');
            var statusMsg = helper.small();
            statusMsg.id = "statusMsg";
            $(statusMsg).click(function () {
                bootbox.prompt("What's up?", utils.statusPromptCallback);
            });
            $h1.text(headline + " (" + utils.getUsername() + ") ");
            $h1.append(statusMsg);
            if (msg.status === null)
                msg.status = "Set your status now! (Click here)";
            $('#statusMsg').text(msg.status).html();

        },
        switchChatLogin: function () {
            $('#login').toggle(1000);
            $('#chat').toggle(1000);
            $('#settings').toggle(1000);
            $('#dummy').toggle(1000);
        },
        changeButton: function () {
            if ($('#registration').prop('checked')) {
                $('#signInButton').text("Sign Up");
            } else {
                $('#signInButton').text("Sign In");
            }
        },
        muted: function () {
            if (localStorage.getObject("muted") === null)
                localStorage.setObject("muted", false);
            return localStorage.getObject("muted");
        },
        setMuteTooltip: function () {
            var msg;
            if (utils.muted())
                msg = "Sounds are off";
            else
                msg = "Sounds are on";
            $('#mute').tooltip().attr("title", msg);
        },
        setMuteButton: function () {
            var button = helper.button("", "btn btn-default", function () {
                    utils.changeMuteButton();
                }),
                on = "volume-up",
                off = "volume-off",
                glyphicon = helper.glyphicon(utils.muted() ? off : on);
            glyphicon.id = "muteIcon";
            button.id = "mute";
            button.appendChild(glyphicon);
            $('#settings').append(button);
        },
        changeMuteButton: function (newValue) {
            var $muteIcon = $('#muteIcon'),
                on = "glyphicon-volume-up",
                off = "glyphicon-volume-off";
            if (newValue === undefined) {
                if (utils.muted()) {
                    $muteIcon.removeClass(off).addClass(on);
                    localStorage.muted = "false";
                } else {
                    $muteIcon.removeClass(on).addClass(off);
                    localStorage.muted = "true";
                }
            } else if (newValue == "true") {
                $muteIcon.removeClass(on).addClass(off);
            } else if (newValue == "false") {
                $muteIcon.removeClass(off).addClass(on);
            }
            utils.setMuteTooltip();
        },
        changePasswordValidated: function () {
            return $('#newPassField').val() == $('#newPassFieldCheck').val();
        },
        hideChangePasswordDialog: function () {
            $('#newPassField').val("");
            $('#newPassFieldCheck').val("");
            $('#changePass').modal('hide');
        },
        htmlEncode: function (value) {
            return $('<div/>').text(value).html();
        },
        getUsername: function () {
            return $('#username').val();
        },
        getPassword: function () {
            return $('#password').val();
        },
        messageDisplay: function () {
            return $('#messages');
        },
        register: function () {
            return $('#registration').prop('checked');
        },
        setOnClickEvents: function () {
            $('#registration').click(utils.changeButton);
            $('#signInButton').click(client.login);
            $('#addFriendButton').click(client.addFriend);
            $('#sendButton').click(client.sendMessage);
            $('#logout').click(client.logout);
            $('#savePassButton').click(client.changePass);
            $('#updateContactsButton').click(function () {
                antiprism.getContacts(utils.displayContacts);
            });
            $('#removeContactButton').click(utils.removeContactPrompt);
            $('#setStatusButton').click(function () {
                bootbox.prompt("What's up?", utils.statusPromptCallback);
            });
            $('#reconnectButton').click(function () {
                antiprism.reconnect();
                $('#serverLost').modal('hide');
            });
        },
        statusPromptCallback: function (result) {
            if (result !== null) {
                if (result.length > 75) {
                    bootbox.prompt("Unfortunately your status was too long. :(\n" +
                        "Allowed are 75, you entered " + result.length + ". " +
                        "Anyway, what's on your mind?", utils.statusPromptCallback);
                } else {
                    client.setStatus(result);
                }
            }
        },
        addKeyEvents: function () {
            $('#login').find(".textField").keyup(function (e) {
                if (e.keyCode == 13) {
                    client.login();
                }
            });
            $('#messageField').keyup(function (e) {
                if (e.keyCode == 13) {
                    client.sendMessage();
                }
            });
            $('#addFriendField').keyup(function (e) {
                if (e.keyCode == 13) {
                    client.addFriend();
                }
            });
            $('#newPassFieldCheck').keyup(function () {
                function validate() {
                    var $div = $('#changePassContainer');
                    if (!utils.changePasswordValidated()) {
                        $div.addClass("has-error");
                        $div.removeClass("has-success");
                        $('#savePassButton').prop("disabled", true);
                    } else {
                        $div.removeClass("has-error");
                        $div.addClass("has-success");
                        $('#savePassButton').prop("disabled", false)
                    }
                }

                validate();
                $('#newPassField').keyup(validate);
            })
        },
        getContactList: function () {
            var contactlist = $('a[class="list-group-item"]').splice(1);
            var contactNames = [];
            for (var contact in contactlist) {
                if (contactlist.hasOwnProperty(contact)) {
                    var name = contactlist[contact].id;
                    contactNames.push(name);
                }
            }
            return contactNames;
        },
        removeContactPrompt: function () {
            bootbox.prompt("What Contact do you want to remove?", function (result) {
                if (result !== null) {
                    var firstResult = result;
                    bootbox.confirm("Are you sure that you want to remove " + result + "?", function (result) {
                        if (result) {
                            antiprism.removeContact(firstResult, function () {
                                antiprism.getContacts(utils.displayContacts);
                            });
                        }
                    });
                }
            });
            $('.bootbox-input').addClass("typeahead").attr("placeholder", "Friend to remove");
            var dataSource = utils.getContactList();

            $('.typeahead').typeahead({
                local: dataSource,
                items: 4,
                minLength: 1
            });
            $('.tt-hint').remove();
        },
        getErrorByCode: function (errorCode) {
            var error;

            var Error = {
                "JSON": -1,
                "MISSING_ACTION": 1,
                "INVALID_NAME": 2,
                "INVALID_ACTION": 3,
                "INVALID_PARAMS": 4,
                "UNKNOWN_USER": 5,
                "INVALID_AUTH": 6,
                "UNKNOWN_PUBKEY": 7
            };
            if (!isNaN(errorCode.error))
                switch (errorCode.error) {
                    case Error.MISSING_ACTION:
                        error = "Missing action parameter.";
                        break;
                    case Error.INVALID_ACTION:
                        error = "Action does not exist.";
                        break;
                    case Error.INVALID_PARAMS:
                        error = "Invalid action parameters.";
                        break;
                    case Error.JSON:
                        error = "JSON parse error.";
                        break;
                    case Error.INVALID_AUTH:
                        error = "Invalid authentication-key";
                        break;
                    case Error.UNKNOWN_USER:
                        error = "Tried to access unknown user.";
                        break;
                    case Error.UNKNOWN_PUBKEY:
                        error = "Requested pubkey does not exist.";
                        break;
                    default:
                        error = "Unknown Error.";
                        break;
                }
            else
                error = errorCode.error;

            return error;
        },
        displayError: function (errorCode) {
            var errorContainer = helper.div("alert alert-danger fade in");
            var closeButton = helper.button("x", "close");
            closeButton.setAttribute("data-dismiss", "alert");
            closeButton.setAttribute("aria-hidden", true);
            errorContainer.appendChild(closeButton);
            errorContainer.innerHTML += "<h4>Error</h4><p>" + utils.getErrorByCode(errorCode) + "</p>";
            errorContainer.id = "alertError";
            $('#headline').append(errorContainer);
            $('#alertError').hide().slideDown(200).delay(2000).fadeOut(1000, function () {
                $('#alertError').remove()
            });
        },
        createContactElement: function (contact, msg) {
            var contactElement = helper.jsLink("");
            var icon = helper.span("online");
            var status = helper.small();
            contactElement.className = "list-group-item";
            contactElement.appendChild(icon);
            contactElement.innerHTML += utils.htmlEncode(contact);
            contactElement.id = contact;
            contactElement.addEventListener("click", function (ctx) {
                var contactName = ctx.target.id || ctx.target.parentNode.id;
                utils.onContactSelect(contactName);
            });
            if (msg.contacts[contact])
                msg.contacts[contact].status !== null ? status.innerHTML = utils.htmlEncode(msg.contacts[contact].status) : status.innerHTML = "";
            else
                status.innerHTML = "";
            contactElement.appendChild(status);
            return contactElement;
        },
        displayContacts: function (msg) {
            console.log(msg);
            var $friendList = $('#friendList');
            var contactList = helper.div("list-group");
            var contactsHeadline = helper.jsLink("<strong>Contactlist</strong>");
            var $active = $('.active');
            contactsHeadline.className = "list-group-item";
            contactsHeadline.id = "contactsHeadline";
            contactList.appendChild(contactsHeadline);

            for (var contact in msg.contacts) {
                if (msg.contacts.hasOwnProperty(contact)) {
                    var contactElement = utils.createContactElement(contact, msg);
                    contactList.appendChild(contactElement);
                }
            }
            for (var i in msg.requests) {
                if (msg.requests.hasOwnProperty(i)) {
                    contactElement = utils.createContactElement(msg.requests[i], msg);
                    contactList.appendChild(contactElement);
                }
            }
//            if (msg.contacts.length == 0 && msg.requests.length == 0) {
//                contactElement = utils.createContactElement("", "");
//                contactList.appendChild(contactElement);
//            } //TODO was passiert, wenn Kontaktliste leer?!?
            if ($active.length)
                var formerSelectedContact = $active[0].id;
            $friendList.text("");
            $friendList.append(contactList);
            for (contact in msg.contacts) {
                if (msg.contacts.hasOwnProperty(contact))
                    utils.displayOnline({user: contact, online: msg.contacts[contact].online, confirmed: msg.contacts[contact].confirmed});
            }
            for (i in msg.requests) {
                if (msg.requests.hasOwnProperty(i))
                    utils.displayOnline({user: msg.requests[i], online: false, request: true});
            }
            if (formerSelectedContact)
                $('#' + formerSelectedContact).addClass("active");
            if (msg.requests === undefined)
                msg.requests = [];
            utils.addFriendsPopover(Object.keys(msg.contacts).length + Object.keys(msg.requests).length);
        },
        displayRetrieveMoreMessagesButton: function (contactName) {
            console.log("displaying retrieveMoreMessagesButton...");
            var container = helper.div("col-md-12");
            var button = helper.button("Retrieve More Messages", "btn btn-info btn-sm btn-block", function () {
                utils.retrieveMessages(contactName);
            });
            button.id = "retrieveMoreMessagesButton";
            button.disabled = "true";
            container.id = "retrieveMoreMessages";
            container.appendChild(button);
            utils.messageDisplay().append(container);
            utils.disableRetrieveMoreMessagesButton(contactName);
        },
        disableRetrieveMoreMessagesButton: function (contactName) {
            if (!sessionStorage[contactName]) {
                console.log("disableRetrieveMoreMessagesButton is called and sessionStorage[\"" + contactName + "\"] does not exist");
                utils.updateContactObject(contactName, function () {
                    var obj = sessionStorage.getObject(contactName);
                    $('#retrieveMoreMessagesButton')[0].disabled = !(obj.msglist.length < obj.numberOfMessages);
                });
                return;
            }
            var obj = sessionStorage.getObject(contactName);
            if (!obj || (obj.msglist.length === 0 && obj.numberOfMessages > 0)) {
                console.log("I'M THE MISTAKE BITCH!!");
                utils.updateContactObject(contactName, function () {
                    var obj = sessionStorage.getObject(contactName);
                    $('#retrieveMoreMessagesButton')[0].disabled = !(obj.msglist.length < obj.numberOfMessages);
                }, obj.numberOfMessages);
                return;
            }
            $('#retrieveMoreMessagesButton')[0].disabled = !(obj.msglist.length < obj.numberOfMessages);
        },
        retrieveMessages: function (contactName) {
            if (sessionStorage[contactName]) {
                var userObj = sessionStorage.getObject(contactName);
                if (userObj.numberOfMessages > userObj.msglist.length) {
                    var diff = userObj.numberOfMessages - userObj.msglist.length;
                    if (diff > 10)
                        diff = 10;
                    antiprism.getMessages(contactName, (0 - userObj.msglist.length - diff),
                        (-1 - userObj.msglist.length), function (msg) {
                            utils.addMessagesToStorage(contactName, msg.msglist, true);
                            msg.msglist = msg.msglist.reverse();
                            utils.displayMessages(msg, contactName, true);
                        });
                }
            }
            else {
                console.log("retrieveMessages is called and has no sessionStorage[\"" + contactName + "\"]!");
                utils.updateContactObject(contactName, function () {
                    utils.retrieveMessages(contactName);
                });
            }
        },
        addFriendsPopover: function (contactLength) {
            if (!contactLength && contactLength !== undefined) {
                var $addFriendField = $('#addFriendField');
                $addFriendField.popover({content: "Add some friends now!", trigger: "manual", placement: "top"});
                $addFriendField.popover("show");
                $addFriendField.focus(function () {
                    $addFriendField.popover("hide")
                });
                $addFriendField.focusout(function () {
                    $addFriendField.popover("show")
                });
                utils.firstLogin = true;
            }
            else if (utils.firstLogin) {
                $('#addFriendField').unbind("focus").unbind("focusout");
            }
        },
        updateContactObject: function (contactName, callback, numberOfMessages) {
            if (numberOfMessages === undefined) {
                console.log("numberOfMessages was undefined! numberOfMessages: " + numberOfMessages);
                // this querying-global is the dirtiest piece of shit ever
                // time to fix the loop-bug that occurs without it!
                antiprism.countMessages(contactName, function (msg) {
                    /*console.group("countMessages-Callback");
                    console.log("got callback from countmessages with msg = " + JSON.stringify(msg));
                    console.log("msg.msgcount = " + msg.msgcount);
                    console.log("functioncall:");
                    console.log("utils.updateContactObject(" + contactName + ", callback, " + msg.msgcount + ");");
                    console.log("callback:");
                    console.log(callback);
                    console.groupEnd("countMessages-Callback");*/
                    utils.updateContactObject(contactName, callback, msg.msgcount);
                });
                return;
            }
            var oldObj = sessionStorage.getObject(contactName);
            var msglist = [];
            if (oldObj)
                msglist = oldObj.msglist;
            var obj = {numberOfMessages: numberOfMessages, msglist: msglist};
            sessionStorage.setObject(contactName, obj);
            if (callback)
                callback();
        },
        onContactSelect: function (contactName) {
            var $contactNode = $('#' + contactName),
                $active = $('.active'),
                userObj = sessionStorage.getObject(contactName),
                iconClass = $contactNode.children()[0].className;
            if ($active.length)
                $active.removeClass("active");
            $contactNode.addClass("active");
            $contactNode.removeClass("newMessage");
            utils.messageDisplay().empty();
            utils.updateContactObject($contactNode[0].id, function () {
                console.log("onContactSelect->updateContactObject callback is called with iconclass: " + iconClass);
                console.log("and contactName: " + contactName);
                if (iconClass.indexOf("glyphicon-user") != -1) {
                    utils.displayRetrieveMoreMessagesButton(contactName);
                    client.getMessages(contactName);
                }
            }, userObj ? userObj.msglist.length : undefined);
            if (iconClass.indexOf("glyphicon-time") != -1) {
                utils.displayMessage({from: contactName, msg: "Waiting for confirmation by user.", ts: (new Date()).getTime()}, contactName, false);
            } else if (iconClass.indexOf("glyphicon-question-sign") != -1)
                utils.displayMessage({from: contactName, msg: "This user sent you a friendrequest. To confirm please click the button below.", ts: (new Date()).getTime(), request: true}, contactName, false);
        },
        urlToLink: function (message) {
            var urlregex = /(\b(https?):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig,
                results = message.match(urlregex);
            for (var link in results) {
                if (results.hasOwnProperty(link)) {
                    var replaced = message.replace(results[link], results[link].link(results[link]));
                    message = replaced.replace("<a", "<a target=_blank");
                }
            }
            return message;
        },
        onMessage: function (msg) {
            console.log("onMessage is called!");
            var userObj = sessionStorage.getObject(msg.from);
            if (!userObj) {
                utils.updateContactObject(msg.from, function () {
                    utils.onMessage(msg);
                });
                return;
            }
            var $active = $('.active'),
                selected = null;
            if ($active.length)
                selected = $active[0].id;
            if (!msg.to && (msg.from != selected || !document.hasFocus())) {
                if (!utils.muted())
                    utils.playSound("ios.mp3");
            }
            utils.pushOneMessageToStorage(msg.from, msg);
            utils.displayMessage(msg, msg.from);
        },
        displayMessage: function (message, contactName, chained, moreMessages) {
            var $active = $('.active');
            var selectedContact = "";
            if (!document.hasFocus())
                $('title').text("#AP - " + contactName + " just contacted you!");
            if ($active.length)
                selectedContact = $active[0].id;
            if (selectedContact == contactName) {
                var panelContainer = helper.div(),
                    panelHeader = helper.div("panel panel-heading"),
                    panelContent = helper.div("panel panel-body"),
                    username = message.from || utils.getUsername(),
                    time = new Date(message.ts),
                    receivedMessage = utils.htmlEncode(message.msg);
                panelContent.innerHTML = utils.urlToLink(receivedMessage);
                if (time.toDateString() != (new Date()).toDateString())
                    time = time.toDateString() + ", " + time.toLocaleTimeString();
                else
                    time = "today, " + time.toLocaleTimeString();
                if (username == utils.getUsername()) {
                    panelContainer.className = "panel panel-success col-md-8 pull-right";
                    panelHeader.innerHTML = time + " | me";
                    panelContent.align = "right";
                    panelHeader.align = "right";
                } else {
                    panelContainer.className = "panel panel-info col-md-8";
                    panelHeader.innerHTML = username + " | " + time;
                }
                panelContainer.appendChild(panelHeader);
                panelContainer.appendChild(panelContent);
                if (moreMessages)
                    $('#retrieveMoreMessages').after(panelContainer);
                else
                    utils.messageDisplay().append(panelContainer);
                if (message.request) {
                    var buttonDiv = helper.div("col-md-12");
                    var confirmButton = helper.button("Confirm " + utils.htmlEncode(contactName), "btn btn-success", function () {
                        antiprism.confirm(contactName, function (ack) {
                            if (ack)
                                utils.messageDisplay().empty();
                            antiprism.getContacts(utils.displayContacts);
                        });
                    });
                    buttonDiv.appendChild(helper.lineBreak());
                    buttonDiv.appendChild(confirmButton);
                    panelContent.appendChild(buttonDiv);
                }
                if (!chained) {
                    utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
                }
            } else {
                $('#' + contactName).addClass("newMessage");
            }
        },
        pushOneMessageToStorage: function (contactname, msg) {
            var userObj = sessionStorage.getObject(contactname);
            userObj.msglist.push(msg);
            userObj.numberOfMessages++;
            sessionStorage.setObject(contactname, userObj);
        },
        addMessagesToStorage: function (contactname, msglist, tail) {  //tail: boolean (if true then the received messages are received by "receiveMoreMessagesButton")
            var userObj = sessionStorage.getObject(contactname);
            if (tail) {
                msglist = msglist.concat(userObj.msglist);
                userObj.msglist = msglist;
            } else userObj.msglist = msglist;
            sessionStorage.setObject(contactname, userObj);
        },
        displayOnline: function (msg) {
            var $user = $('#' + msg.user);
            if ($user.children().length > 0) {
                if (msg.confirmed === undefined) {
                    if (msg.online)
                        $user.children()[0].className = "glyphicon glyphicon-user online";
                    else if ($user.children()[0].className != "glyphicon glyphicon-user" && !msg.request)
                        $user.children()[0].className = "glyphicon glyphicon-user";
                    else
                        $user.children()[0].className = "glyphicon glyphicon-question-sign";
                } else
                    $user.children()[0].className = "glyphicon glyphicon-time";
            }
        },
        displayMessages: function (msg, contactName, moreMessages) {
            for (var i in msg.msglist) {
                if (msg.msglist.hasOwnProperty(i))
                    utils.displayMessage(msg.msglist[i], contactName, true, moreMessages);
            }
            if (!moreMessages)
                utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
            utils.disableRetrieveMoreMessagesButton(contactName);
        },
        playSound: function (mp3) {
            var sound = new Audio();
            sound.src = sound.canPlayType("audio/mpeg") ? mp3 : console.log("BING - you have got a new message!"); //TODO fallback einrichten
            sound.play();
        }
    };

var client = {
    init: function () {
        utils.addKeyEvents();
        utils.setOnClickEvents();
        utils.setMuteTooltip();
        utils.setMuteButton();
        if (!antiprism) //TODO not good enough
            sessionStorage.clear();
        window.addEventListener("storage", function (storageEvent) {
            console.log(storageEvent);
            if (storageEvent.key == "muted" && storageEvent.url == document.URL)
                utils.changeMuteButton(storageEvent.newValue);
        }, true);
    },
    lostConnection: function (reconnected) {
        if (!reconnected) {
            $('#serverLost').modal();
        }
    },
    getMessages: function (contactName, start, end) {
        var userObj = sessionStorage.getObject(contactName);
        if (userObj) {
            if (userObj.msglist.length >= 10) {
                utils.displayMessages(userObj, contactName);
                console.log("displayed messages from sessionstorage");
                return;
            }
        }
        else {
            console.log("getMessages was called and it has no sessionstorage[\"" + contactName + "\"]!");
            utils.updateContactObject(contactName);
        }
        if (start === undefined)
            start = -10;
        if (end === undefined) {
            end = -1;
        }
        antiprism.getMessages(contactName, start, end, function (msg) {
            utils.addMessagesToStorage(contactName, msg.msglist);
            utils.displayMessages(msg, contactName);
        });
    },
    sendMessage: function () {
        var $messageField = $('#messageField');
        var message = $messageField.val();
        if (!message)
            return;
        var to = null;
        var $active = $('.active');
        if ($active.length)
            to = $active[0].id;
        $messageField.val('');
        if (to)
            antiprism.sendMessage(to, message, function (msg) {
                var sentMessage = {to: to, ts: msg.ts, msg: message};
                utils.pushOneMessageToStorage(to, sentMessage);
                utils.displayMessage(sentMessage, to);
            });
        else {
            utils.displayMessage({to: null, ts: (new Date()).getTime(), msg: "You didn\'t choose a contact!"});
        }
    },
    changePass: function () {
        if (utils.changePasswordValidated()) {
            var $passwordField = $('#newPassField');
            antiprism.changePassword($passwordField.val());
            $('#changePassContainer').removeClass("has-success");
            $passwordField.unbind("keyup");
            utils.hideChangePasswordDialog();
        }
    },
    setStatus: function (statusMsg) {
        antiprism.setStatus(statusMsg, function () {
            utils.setHeadline({status: statusMsg});
        });
    },
    addFriend: function () {
        var friend = $('#addFriendField').val();
        if (!friend)
            return;
        antiprism.initConversation(friend, function (msg) {
            if (msg.initiated)
                antiprism.getContacts(utils.displayContacts);
            else
                utils.displayError({error: "Did not initiate conversation with <b>" + utils.htmlEncode(friend) + "</b>. You may already added him or he may not exist."});
        });
    },
    login: function () {
        var username = utils.getUsername(),
            password = utils.getPassword(),
            registration = utils.register(),

            host = location.origin.replace(/^http/, 'ws'),
            callback = function (msg) {
                console.log("got " + JSON.stringify(msg));
                if (msg) {
                    utils.switchChatLogin();
                    console.log("asking for contacts..");
                    antiprism.getContacts(function (msg) {
                        console.log("contacts-callback called!");
                        utils.displayContacts(msg);
                    });
                    antiprism.getStatus(utils.setHeadline);
                } else {
                    $('#loginAlert').fadeIn(1000, function () {
                        setTimeout(function () {
                            $('#loginAlert').fadeOut()
                        }, 5000)
                    })
                }
                $('#password').val("");
            };
        antiprism = new Antiprism(host, true); // params: host,[debugFlag]
        if (registration)
            antiprism.register(username, password, function () {
                antiprism.login(username, password, callback)
            });
        else
            antiprism.login(username, password, callback);
        antiprism.addEventListener("msg", utils.onMessage);
        antiprism.addEventListener("closed", client.lostConnection);
        antiprism.addEventListener("error", utils.displayError);
        antiprism.addEventListener("online", utils.displayOnline);
        antiprism.addEventListener("added", function () {
            antiprism.getContacts(utils.displayContacts);
        });
    },
    logout: function () {
        antiprism.close();
        $('h1').text(headline);
        utils.messageDisplay().text("");
        utils.switchChatLogin();
        sessionStorage.clear();
    }
};

var helper = {
    addStorageObjectFunctions: function () {
        Storage.prototype.setObject = function (key, value) {
            this.setItem(key, JSON.stringify(value));
        };

        Storage.prototype.getObject = function (key) {
            var value = this.getItem(key);
            return value && JSON.parse(value);
        }
    },
    lineBreak: function () {
        return document.createElement("br");
    },
    div: function (className) {
        var div = document.createElement("div");
        if (className === undefined)
            className = "";
        div.className = className;
        return div;
    },
    span: function (className, value) {
        if (value === undefined)
            value = "";
        var span = document.createElement("span");
        span.className = className;
        span.innerHTML = value;
        return span;
    },
    input: function (type, name) {
        var input = document.createElement("input");
        input.type = type;
        input.className = "form-control";
        input.id = name;
        input.placeholder = name;
        return input;
    },
    a: function (linkName, location) {
        var a = document.createElement("a");
        a.innerHTML = linkName;
        a.href = location;
        return a;
    },
    small: function (innerHTML) {
        var small = document.createElement("small");
        if (innerHTML === undefined)
            innerHTML = "";
        small.innerHTML = innerHTML;
        return small;
    },
    button: function (value, className, clickEvent) {
        var button = document.createElement("button");
        button.className = className;
        button.innerHTML = value;
        button.type = "button";
        if (clickEvent)
            button.onclick = clickEvent;
        return button;
    },
    ul: function (className) {
        var ul = document.createElement("ul");
        ul.className = className;
        return ul;
    },
    li: function (className) {
        var li = document.createElement("li");
        li.className = className;
        return li;
    },
    option: function (optionName) {
        var option = document.createElement("option");
        option.value = optionName;
        option.innerHTML = optionName;
        return option;
    },
    select: function (optionsArray) {
        var select = document.createElement("select");
        select.className = "form-control";
        for (var i in optionsArray) {
            if (optionsArray.hasOwnProperty(i)) {
                var option = helper.option(optionsArray[i]);
                select.appendChild(option);
            }
        }
        return select;
    },
    form: function (className) {
        var form = document.createElement("form");
        form.role = "form";
        form.className = className;
        return form;
    },
    jsLink: function (linkName, clickEvent) {
        var jsLink = helper.a(linkName, "#");
        if (clickEvent)
            jsLink.onclick = clickEvent;
        jsLink.className = "jsLink";
        return jsLink;
    },
    glyphicon: function (name) {
        return helper.div("glyphicon glyphicon-" + name);
    }
};