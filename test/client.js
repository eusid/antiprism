/**
 * client.js
 *
 * Chatclient for Project Antiprism using the antiprismSDK
 * -------------------------------------------------------
 * 
 * ideas for functionalism's:
 * -------------------------
 *
 *    - Groupchat (wait for server implementation)
 *
 *    - !!show more messages: * button which get more messages?
 *                            * number of messages: $('#messages').children().length (-1?)
 *                            * easy way: just empty messagefield and load the messages again + around 20
 *                            * better way: load only older messages and display them in front of the others
 *
 *    - !Work with the localstorage (e.g. save mute-setting)
 *                      
 */

$(document).ready(function () {
  client.init();
  $('form').submit(function(e) {e.preventDefault(); });
});

var antiprism,
    utils = {
    firstLogin: false,
    setHeadline: function (msg) {
        var $h1 = $('h1');
        var statusMsg = helper.small();
        statusMsg.id = "statusMsg";
        $h1.text(headline + " (" + utils.getUsername() + ") ");
        $h1.append(statusMsg);
        if (msg.status === null)
            msg.status = "Set your status now! (Click on Settings->set status)";
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
        return $('#muteIcon')[0].classList[1] == "glyphicon-volume-off";
    },
    setMuteTooltip: function () {
        var msg;
        if (utils.muted())
            msg = "Sounds are off";
        else
            msg = "Sounds are on";
        $('#mute').tooltip().attr("title", msg);
    },
    changeMuteButton: function () {
        var muteIconClassList = $('#muteIcon')[0].classList;
        console.log(muteIconClassList);
        var on = "glyphicon-volume-up";
        var off = "glyphicon-volume-off";
        if (utils.muted()) {
            muteIconClassList.remove(off);
            muteIconClassList.add(on);
        } else {
            muteIconClassList.remove(on);
            muteIconClassList.add(off);
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
        $('#mute').click(function () {
            utils.changeMuteButton();
        });
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
        $('#newPassFieldCheck').keyup(function (    ) {
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
            if(contactlist.hasOwnProperty(contact)) {
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
                            console.log("Successfully removed contact: " + result);
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
        console.log(errorCode);
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
        var contactElement = helper.a("", "#");
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
        var friendList = $('#friendList');
        var contactList = helper.div("list-group");
        var contactsHeadline = helper.a("<strong>Contactlist</strong>", "");
        var $active = $('.active');
        contactsHeadline.className = "list-group-item";
        contactsHeadline.id = "contactsHeadline";
        contactList.appendChild(contactsHeadline);

        for (var contact in msg.contacts) {
            if(msg.contacts.hasOwnProperty(contact)) {
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
        if ($active.length)
            var formerSelectedContact = $active[0].id;
        friendList.text("");
        friendList.append(contactList);
        for (contact in msg.contacts) {
            if(msg.contacts.hasOwnProperty(contact))
                utils.displayOnline({user: contact, online: msg.contacts[contact].online, confirmed: msg.contacts[contact].confirmed});
        }
        for (i in msg.requests) {
            if(msg.requests.hasOwnProperty(i))
                utils.displayOnline({user: msg.requests[i], online: false, request: true});
        }
        if (formerSelectedContact)
            $('#' + formerSelectedContact).addClass("active");
        if (msg.requests === undefined)
            msg.requests = [];
        utils.addFriendsPopover(Object.keys(msg.contacts).length + msg.requests.length);
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
    onContactSelect: function (contactName) {
        $('.active').removeClass("active");
        var $contactNode = $('#' + contactName);
        $contactNode.addClass("active");
        $contactNode.removeClass("newMessage");
        utils.messageDisplay().empty();
        var iconClass = $contactNode.children()[0].className;
        console.log(iconClass);
        if (iconClass.indexOf("glyphicon-user") != -1)
            client.getMessages(contactName);
        else if (iconClass.indexOf("glyphicon-time") != -1) {
            utils.displayMessage({from: contactName, msg: "Waiting for confirmation by user.", ts: (new Date()).getTime()}, false);
            console.log("Waiting for confirmation");
        } else if (iconClass.indexOf("glyphicon-question-sign") != -1)
            utils.displayMessage({from: contactName, msg: "This user sent you a friendrequest. To confirm please click the button below.", ts: (new Date()).getTime(), request: true}, false);
    },
    urlToLink: function (message) {
        var urlregex = /(\b(https?):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig,
            results = message.match(urlregex);
        for (var link in results) {
            if(results.hasOwnProperty(link)) {
                var replaced = message.replace(results[link], results[link].link(results[link]));
                message = replaced.replace("<a", "<a target=_blank");
            }
        }
        return message;
    },
    displayMessage: function (message, chained) {
        console.log(message);
        var contactName = message.from || message.to;
        var $active = $('.active');
        var selectedContact = "";
        if (!document.hasFocus())
            $('title').text("#AP - " + contactName + " just contacted you!");
        if ($active.length)
            selectedContact = $active[0].id;
        if (selectedContact == message.from || selectedContact == message.to || utils.getUsername() == message.from) {
            var panelContainer = helper.div();
            var panelHeader = helper.div("panel panel-heading");
            var panelContent = helper.div("panel panel-body");
            var username = message.from || utils.getUsername();
            var time = (new Date(message.ts)).toLocaleTimeString().split(' ');
            panelContent.textContent = utils.urlToLink(message.msg);
            panelHeader.innerHTML = time;
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
            utils.messageDisplay().append(panelContainer);
            if (message.request) {
                var buttonDiv = helper.div("col-md-12");
                var confirmButton = helper.button("Confirm " + utils.htmlEncode(message.from), "btn btn-success", function () {
                    antiprism.confirm(message.from, function (ack) {
                        if (ack)
                            utils.messageDisplay().empty();
                        antiprism.getContacts(utils.displayContacts);
                    });
                });
                buttonDiv.appendChild(helper.lineBreak());
                buttonDiv.appendChild(confirmButton);
                panelContent.appendChild(buttonDiv);
            }
            if (!chained)
                utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
        } else {
            $('#' + contactName).addClass("newMessage");
        }
    },
    displayOnline: function (msg) {
        var $user = $('#' + msg.user);
        if (msg.confirmed === undefined) {
            if (msg.online)
                $user.children()[0].className = "glyphicon glyphicon-user online";
            else if (!msg.online && $user.children()[0].className != "glyphicon glyphicon-user" && !msg.request)
                $user.children()[0].className = "glyphicon glyphicon-user";
            else if (msg.request)
                $user.children()[0].className = "glyphicon glyphicon-question-sign";
        } else
            $user.children()[0].className = "glyphicon glyphicon-time";
    },
    displayMessages: function (msg) {
        console.log(msg);
        for (var i in msg.msglist) {
            if(msg.msglist.hasOwnProperty(i))
                utils.displayMessage(msg.msglist[i], true);
        }
        utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
    },
    playSound: function (mp3) {
        var sound = new Audio();
        sound.src = sound.canPlayType("audio/mpeg") ? mp3 : fallback;
        sound.play();
    }
};

var client = {
    init: function () {
        utils.addKeyEvents();
        utils.setOnClickEvents();
        utils.setMuteTooltip();
    },
    lostConnection: function (reconnected) {
        if (!reconnected) {
            $('#serverLost').modal();
        }
    },
    getMessages: function (contactName) {
        antiprism.getMessages(contactName, -10, -1, utils.displayMessages);
    },
    sendMessage: function () {
        var messageField = $('#messageField');
        var message = messageField.val();
        if (!message)
            return;
        var to = null;
        var $active = $('.active');
        if ($active.length)
            to = $active[0].id;
        messageField.val('');
        if (to)
            antiprism.sendMessage(to, message, function (msg) {
                utils.displayMessage({to: to, ts: msg.ts, msg: message});
            });
        else {
            utils.displayMessage({to: null, ts: (new Date()).getTime(), msg: "You didn\'t choose a contact!"});
            if (message == "clear()")
                $('#messages').text("");
        }
    },
    changePass: function () {
        if (utils.changePasswordValidated()) {
            antiprism.changePassword($('#newPassField').val());
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
                if (msg) {
                    utils.switchChatLogin();
                    antiprism.getContacts(utils.displayContacts);
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
        antiprism = new Antiprism(host,true); // params: host,[debugFlag]
        if (registration)
            antiprism.register(username, password, callback);
        else
            antiprism.login(username, password, callback);
        antiprism.addEventListener("msg", function (msg) {
            var $active = $('.active'),
                selected = null;
            if ($active.length)
                selected = $active.innerHTML;
            if (!msg.to && (msg.from != selected || !document.hasFocus())) {
                if (!utils.muted())
                    utils.playSound("ios.mp3");
            }
            utils.displayMessage(msg);
        });
        antiprism.addEventListener("closed",client.lostConnection);
        antiprism.addEventListener("error",utils.displayError);
        antiprism.addEventListener("online",utils.displayOnline);
        antiprism.addEventListener("added",function () {
            antiprism.getContacts(utils.displayContacts);
        });
    },
    logout: function () {
        antiprism.close();
        $('h1').text(headline);
        $('#messages').text("");
        utils.switchChatLogin();
    }
};

var helper = {
  lineBreak: function() {
    return document.createElement("br");
  },
  div: function(className) {
    var div = document.createElement("div");
    if(className === undefined)
      className = "";
    div.className = className;
    return div;
  },
  span: function(className, value) {
    if(value === undefined)
      value = "";
    var span = document.createElement("span");
    span.className = className;
    span.innerHTML = value;
    return span;
  },
  input: function(type, name) {
    var input = document.createElement("input");
    input.type = type;
    input.className = "form-control";
    input.id = name;
    input.placeholder = name;
    return input;
  },
  a: function(linkName, location) {
    var a = document.createElement("a");
    a.innerHTML = linkName;
    a.href = location;
    return a;
  },
  small: function(innerHTML) {
    var small = document.createElement("small");
    if(innerHTML === undefined)
      innerHTML = "";
    small.innerHTML = innerHTML;
    return small;
  },
  button: function(value, className, clickEvent) {
    var button = document.createElement("button");
    button.className = className;
    button.innerHTML = value;
    button.type = "button";
    if(clickEvent)
      button.onclick = clickEvent;
    return button;
  },
  dropdownButton: function(value, btnType) {
    if(btnType === undefined)
      btnType = "default";

    var dropdownButton = helper.button(value, "btn btn-" + btnType + " dropdown-toggle");
    dropdownButton.setAttribute("data-toggle","dropdown");
    dropdownButton.appendChild(helper.span("caret"));
    return dropdownButton;
  },
  ul: function(className) {
    var ul = document.createElement("ul");
    ul.className = className;
    return ul;
  },
  ulMenu: function() {
    var ulMenu = helper.ul("dropdown-menu");
    ulMenu.role = "menu";
    return ulMenu;
  },
  dropdownListElement: function(text) {
    var li = document.createElement("li"),
      a = helper.a(text, "#");
    li.appendChild(a);
    return li;
  },
  dropdownList: function(buttonText, linkArray) {
    var dropdownListContainer = helper.div("btn-group"),
      button = helper.dropdownButton(buttonText),
      ulMenu = helper.ulMenu();
    dropdownListContainer.appendChild(button);
    for(var i in linkArray) {
        if(linkArray.hasOwnProperty(i)) {
            var listElement = helper.dropdownListElement(linkArray[i]);
            listElement.onclick = function(ctx) {console.log(ctx);};
            ulMenu.appendChild(listElement);
        }
    }
    dropdownListContainer.appendChild(ulMenu);
    return dropdownListContainer;
  },
  option: function(optionName) {
    var option = document.createElement("option");
    option.value = optionName;
    option.innerHTML = optionName;
    return option;
  },
  select: function(optionsArray) {
    var select = document.createElement("select");
    select.className = "form-control";
    for(var i in optionsArray) {
        if(optionsArray.hasOwnProperty(i)) {
          var option = helper.option(optionsArray[i]);
          select.appendChild(option);
        }
    }
    return select;
  },
  form: function(className) {
    var form = document.createElement("form");
    form.role = "form";
    form.className = className;
    return form;
  },
  jsLink: function(linkName, clickEvent) {
    var jsLink = helper.a(linkName, "#");
    jsLink.onclick = clickEvent;
    jsLink.className = "jsLink";
    return jsLink;
  },
  glyphicon: function(name) {
    return helper.div("glyphicon glyphicon-" + name);
  },
  createObjectFromArrays: function(keyArray, valueArray) {
    var objStr = "{";
    for (var i = 0; i < keyArray.length; i++) {
      objStr += "\"" + keyArray[i] + "\":\"" + valueArray[i] + "\",";
    }
    objStr = objStr.substr(0,objStr.length-1);
    objStr += "}";
    try {
      return JSON.parse(objStr);
    }
    catch (e) {
      return -1;
    }
  },
  getValuesFromArray: function(selectArray) {
    var result = [];
    for(var i = 0; i < selectArray.length; i++) {
      result.push(selectArray[i].value);
    }
    return result;
  }

};