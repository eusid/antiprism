/**
 * client.js
 *
 * Chatclient for Project Antiprism using the antiprismSDK
 * -------------------------------------------------------
 * 
 * ideas for functionalitys:
 * -------------------------
 *
 *    - Groupchat (wait for server implementation)
 *
 *    - !!show more messages: * button which get more messages?
 *                            * number of messages to retrieve: $('#messages').children().length
 *                            * easy way: just empty messagefield and load the messages again + around 20
 *                            * better way: load only older messages and display them in front of the others
 *
 *    - !Work with the localstorage (e.g. save mute-setting)
 *
 *    - Friendrequests: * confirm-button if not friends and not requested
 *                      * if not friends but requested: little message: "waiting for confirmation"
 *                      
 */

$(document).ready(function () {
  client.init();
  $('form').submit(function(e) {e.preventDefault(); });
});

var utils = {
  firstLogin: false,
  setHeadline: function(msg) {
    var $h1 = $('h1');
    var statusMsg = document.createElement("small");
    statusMsg.id = "statusMsg";
    $h1.text(headline + " (" + utils.getUsername() + ") ");
    $h1.append(statusMsg);
    if(msg.status === null)
      msg.status = "Set your status now! (Click on Settings->set status)";
    $('#statusMsg').text(msg.status).html();

  },
  switchChatLogin: function() {
    $('#login').toggle(1000);
    $('#chat').toggle(1000);
    $('#settings').toggle(1000);
    $('#dummy').toggle(1000);
  },
  changeButton: function() {
    if($('#registration').prop('checked')) {
      $('#signInButton').text("Sign Up");
    } else {
      $('#signInButton').text("Sign In");
    }
  },
  muted: function() {
    return $('#muteIcon')[0].classList[1] == "glyphicon-volume-off";
  },
  setMuteTooltip: function() {
    if(utils.muted())
      var msg = "Sounds are off";
    else
      var msg = "Sounds are on";
    $('#mute').tooltip().attr("title", msg);
  },
  changeMuteButton: function() {
    var muteIconClassList = $('#muteIcon')[0].classList;
    console.log(muteIconClassList);
    var on = "glyphicon-volume-up";
    var off = "glyphicon-volume-off";
    if(utils.muted()) {
      muteIconClassList.remove(off);
      muteIconClassList.add(on);
    } else {
      muteIconClassList.remove(on);
      muteIconClassList.add(off);
    }
    utils.setMuteTooltip();
  },
  changePasswordValidated: function() {
    return $('#newPassField').val() == $('#newPassFieldCheck').val();
  },
  hideChangePasswordDialog: function() {
    $('#newPassField').val("");
    $('#newPassFieldCheck').val("");
    $('#changePass').modal('hide');
  },
  htmlEncode: function (value){
    return $('<div/>').text(value).html();
  },
  getUsername: function() {
    return $('#username').val();
  },
  getPassword: function() {
    return $('#password').val();
  },
  messageDisplay: function() {
    return $('#messages');
  },
  register: function() {
    return $('#registration').prop('checked');
  },
  setOnClickEvents: function() {
    $('#registration').click(utils.changeButton);
    $('#signInButton').click(client.login);
    $('#addFriendButton').click(client.addFriend);
    $('#sendButton').click(client.sendMessage);
    $('#mute').click(function(){utils.changeMuteButton();});
    $('#logout').click(client.logout);
    $('#savePassButton').click(client.changePass);
    $('#updateContactsButton').click(function() {
      antiprism.getContacts(utils.displayContacts);
    });
    $('#removeContactButton').click(utils.removeContactPrompt);
    $('#setStatusButton').click(function() {
      bootbox.prompt("What's up?", utils.statusPromptCallback);
    });
    $('#reconnectButton').click(function() {
      antiprism.reconnect();
      $('#serverLost').modal('hide');
    });
  },
  statusPromptCallback: function(result) {
    if (result !== null) {
      if(result.length > 75) {
        bootbox.prompt("Unfortunately your status was too long. :(\n" +
          "Allowed are 75, you entered " + result.length + ". " +
          "Anyway, what's on your mind?", utils.statusPromptCallback);
      } else {                                             
        client.setStatus(result);                              
      }
    }
  },
  addKeyEvents: function() {
    $('#login').find(".textField").keyup(function(e){
      if(e.keyCode == 13) {
          client.login();
      }
    });
    $('#messageField').keyup(function(e) {
      if(e.keyCode == 13) {
          client.sendMessage();
      }
    });
    $('#addFriendField').keyup(function(e) {
      if(e.keyCode == 13) {
        client.addFriend();
      }
    });
    $('#newPassFieldCheck').keyup(function(e) {
      function validate() {
        var $div = $('#changePassContainer');
        if(!utils.changePasswordValidated()) {
          $div.addClass("has-error");
          $div.removeClass("has-success");
          $('#savePassButton').prop("disabled", true);
        } else {
          $div.removeClass("has-error")
          $div.addClass("has-success");
          $('#savePassButton').prop("disablattred", false)
        }
      }
      validate();
      $('#newPassField').keyup(validate);
    })
  },
  getContactList: function() {
    var contactlist = $('a[class="list-group-item"]').splice(1);
    var contactNames = [];
    for (var contact in contactlist) {
      var name = contactlist[contact].id;
      contactNames.push(name);
    }
    return contactNames;
  },
  removeContactPrompt: function() {
    
    bootbox.prompt("What Contact do you want to remove?", function(result) {
      console.log("DEBUG: result");
      console.log(result);
      if(result !== null) {
        var firstResult = result;
        bootbox.confirm("Are you sure that you want to remove " + result + "?", function(result) {
          if(result) {
            antiprism.removeContact(firstResult, function() {
              console.log("Succesfully removed contact: " + result);
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
      items:4,
      minLength:1,
    });
    $('.tt-hint').remove();
  },
  getErrorByCode: function(errorCode) {
    console.log(errorCode);
    var error;

    Error = {
      "JSON": -1,
      "MISSING_ACTION": 1,
      "INVALID_NAME": 2,
      "INVALID_ACTION": 3,
      "INVALID_PARAMS": 4,
      "UNKNOWN_USER": 5,
      "INVALID_AUTH": 6,
      "UNKNOWN_PUBKEY": 7,
    };
    if(!isNaN(errorCode.error))
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
    console.log(error);

    return error;
  },
  displayError: function(errorCode) {
    var errorContainer = document.createElement("div");
    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "close";
    closeButton.setAttribute("data-dismiss", "alert");
    closeButton.setAttribute("aria-hidden", true);
    closeButton.innerHTML = "x";
    errorContainer.appendChild(closeButton);
    errorContainer.className = "alert alert-danger fade in";
    errorContainer.innerHTML += "<h4>Error</h4><p>" + utils.getErrorByCode(errorCode) + "</p>";
    errorContainer.id = "alertError";
    $('#headline').append(errorContainer);
    $('#alertError').hide().slideDown(200).delay(2000).fadeOut(1000,function(){$('#alertError').remove()});
  },
  createContactElement: function(contact, msg) {
    var contactElement = document.createElement("a");
    var icon = document.createElement("span");
    var status = document.createElement("small");
    icon.className = "online";
    contactElement.href = "#";
    contactElement.className = "list-group-item";
    contactElement.appendChild(icon);
    contactElement.innerHTML += utils.htmlEncode(contact);
    contactElement.id = contact;
    contactElement.addEventListener("click",function(ctx) {
      var contactName = ctx.target.id || ctx.target.parentNode.id;
      utils.onContactSelect(contactName);
    });
    if(msg.contacts[contact])
      msg.contacts[contact].status !== null? status.innerHTML = utils.htmlEncode(msg.contacts[contact].status) : status.innerHTML = "";
    else
      status.innerHTML = "";
    contactElement.appendChild(status);
    return contactElement;
  },
  displayContacts: function(msg) {
    console.log(msg);
    var friendList = $('#friendList');
    var contactList = document.createElement("div");
    var contactsHeadline = document.createElement("a");
    var headlineStr = document.createElement("strong");
    contactList.className = "list-group";
    contactsHeadline.className = "list-group-item";
    contactsHeadline.id = "contactsHeadline";
    headlineStr.innerHTML = "Contactlist";
    contactsHeadline.appendChild(headlineStr);
    contactList.appendChild(contactsHeadline);

    for (var contact in msg.contacts) {
      var contactElement = utils.createContactElement(contact, msg);
      contactList.appendChild(contactElement);
    }
    for (var i in msg.requests) {
      var contactElement = utils.createContactElement(msg.requests[i], msg);
      contactList.appendChild(contactElement);
    }
    if($('.active').length)
      var formerSelectedContact = $('.active')[0].id;
    friendList.text("");
    friendList.append(contactList);
    for(var contact in msg.contacts) {
      utils.displayOnline({user:contact, online:msg.contacts[contact].online, confirmed:msg.contacts[contact].confirmed});
    }
    for(var i in msg.requests) {
      utils.displayOnline({user:msg.requests[i], online:false, request:true});
    }
    if(formerSelectedContact)
      $('#'+formerSelectedContact).addClass("active");
    if (msg.requests === undefined)
      msg.requests = [];
    utils.addFriendsPopover(Object.keys(msg.contacts).length + msg.requests.length);
  },
  addFriendsPopover: function(contactLength) {
    if(!contactLength && contactLength !== undefined) {
      $addFriendField = $('#addFriendField');
      $addFriendField.popover({content:"Add some friends now!", trigger:"manual", placement:"top"});  
      $addFriendField.popover("show");
      $addFriendField.focus(function() {$addFriendField.popover("hide")});
      $addFriendField.focusout(function() {$addFriendField.popover("show")});
      utils.firstLogin = true;
    }
    else if(utils.firstLogin) {
      $('#addFriendField').unbind("focus").unbind("focusout");
    }
  },
  onContactSelect: function(contactName) { 
    $('.active').removeClass("active");  
    var $contactNode = $('#'+contactName);
    $contactNode .addClass("active");
    $contactNode.removeClass("newMessage");
    utils.messageDisplay().empty();
    var iconClass = $contactNode.children()[0].className;
    console.log(iconClass);
    if(iconClass.indexOf("glyphicon-user") != -1)
      client.getMessages(contactName);
    else if (iconClass.indexOf("glyphicon-time") != -1) {
      utils.displayMessage({from:contactName,msg:"Waiting for confirmation by user.",ts:(new Date()).getTime()}, false);
      console.log("Waiting for confirmation");
    } else if (iconClass.indexOf("glyphicon-question-sign") != -1)
      utils.displayMessage({from:contactName,msg:"This user sent you a friendrequest. To confirm please click the button below.",ts:(new Date()).getTime(),request:true}, false);
  },
  urlToLink: function(message) {
    var urlregex = /(\b(https?):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig,
        results = message.match(urlregex);
    for(link in results) {
      var replaced = message.replace(results[link],results[link].link(results[link]));
      message = replaced.replace("<a","<a target=_blank");
    }
    return message;
  },
  displayMessage: function(message, chained) {
    console.log(message);
    var contactName = message.from || message.to;
    var $active = $('.active');
    var selectedContact = "";
    if(!document.hasFocus())
      $('title').text("#AP - " + contactName + " just contacted you!");
    if ($active.length)
      var selectedContact = $active[0].id;
    if (selectedContact == message.from || selectedContact == message.to || utils.getUsername() == message.from) {
      var panelContainer = document.createElement("div");
      var panelHeader = document.createElement("div");
      var panelContent = document.createElement("div");
      var username = message.from || utils.getUsername();
      var time = (new Date(message.ts)).toLocaleTimeString().split(' ');
      panelHeader.className = "panel panel-heading";
      panelContent.className = "panel panel-body";
      panelContent.textContent = utils.urlToLink(message.msg);
      panelHeader.innerHTML = time;
      if(username == utils.getUsername()) {
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
      if(message.request) {
        var buttonDiv = document.createElement("div");
        var confirmButton = document.createElement("button");
        confirmButton.innerHTML = "Confirm " + utils.htmlEncode(message.from);
        confirmButton.className = "btn btn-success";
        confirmButton.onclick = function() {
          console.log("Confirming " + message.from + "...");
          antiprism.confirm(message.from, function(ack) {
            console.log("confirmprocess sent back " + ack);
            if(ack)
              utils.messageDisplay().empty();
            antiprism.getContacts(utils.displayContacts);
          });
        }
        buttonDiv.className = "col-md-12";
        buttonDiv.appendChild(document.createElement("br"));
        buttonDiv.appendChild(confirmButton);
        panelContent.appendChild(buttonDiv);
      }
      if(!chained)
        utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
    } else {
      $('#'+contactName).addClass("newMessage");
    }
  },
  statusIcon: function() {
    var statusIcon = document.createElement("span");
    statusIcon.className = "glyphicon glyphicon-ok-sign online";
    return statusIcon;
  },
  displayOnline: function(msg) {
    var $user = $('#'+msg.user);
    if(msg.confirmed === undefined) {
      if(msg.online)
        $user.children()[0].className = "glyphicon glyphicon-user online";
      else if (!msg.online && $user.children()[0].className != "glyphicon glyphicon-user" && !msg.request)
          $user.children()[0].className = "glyphicon glyphicon-user";
        else if(msg.request)
          $user.children()[0].className = "glyphicon glyphicon-question-sign";
    } else
      $user.children()[0].className = "glyphicon glyphicon-time";
  },
  displayMessages: function(msg) {
    console.log(msg);
    for(var i in msg.msglist) {
      utils.displayMessage(msg.msglist[i], true);
    }
    utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
  },
  playSound: function(mp3, fallback) {
    var sound = new Audio();
    sound.src = sound.canPlayType("audio/mpeg")?mp3:fallback;
    sound.play();
  }
}

var client = {
  init: function() {
    utils.addKeyEvents();
    utils.setOnClickEvents();
    utils.setMuteTooltip();
  },
  lostConnection:function(reconnected) {
    if(!reconnected)
      $('#serverLost').modal();
  },
  getMessages: function(contactName) {
    antiprism.getMessages(contactName, -10, -1, utils.displayMessages);
  },
  sendMessage: function() {
    var messageField = $('#messageField');
    var message = messageField.val();
    if (!message)
      return;
    var to = null;
    var $active = $('.active');
    if ($active.length)
      to = $active[0].id;
    messageField.val('');
    if(to)
      antiprism.sendMessage(to, message, function(msg) {
          utils.displayMessage({to:to,ts:msg.ts,msg:message});
      });
    else {
      utils.displayMessage({to:null,ts:(new Date()).getTime(),msg:"You didn\'t choose a contact!"});
      if(message == "clear()")
        $('#messages').text("");
    }
  },
  changePass: function() {
    if(utils.changePasswordValidated()) {
      antiprism.changePassword($('#newPassField').val());
      utils.hideChangePasswordDialog();
    }
  },
  setStatus: function(statusMsg) {
    antiprism.setStatus(statusMsg, function() {
      utils.setHeadline({status:statusMsg});
    });
  },
  addFriend: function() {
    var friend = $('#addFriendField').val();
    if (!friend)
      return;
    antiprism.initConversation(friend, function(msg) {
      if (msg.initiated)
        antiprism.getContacts(utils.displayContacts);
      else
        utils.displayError({error:"Did not initiate conversation with <b>" + utils.htmlEncode(friend) + "</b>. You may already added him or he may not exist."});
    });
  },
  login: function() {
    var username = utils.getUsername();
    var password = utils.getPassword();
    var registration = utils.register();

    var host = location.origin.replace(/^http/, 'ws');
    antiprism.init(username, password,host, {
      msg: function(msg) {
        var $active = $('.active');
        var selected = null;
        if ($active.length)
          selected = $active.innerHTML;
        if(!msg.to && (msg.from != selected || !document.hasFocus())) {
          if(!utils.muted())
            utils.playSound("ios.mp3");
        }
        utils.displayMessage(msg);
      },
      closed: client.lostConnection,
      error: utils.displayError,
      online: utils.displayOnline,
      added: function(msg) {
        console.log("got added by "+msg.user+", refreshing...");
        antiprism.getContacts(utils.displayContacts);
      }
    });

    var callback = function(msg) {
      if(msg) {
        utils.switchChatLogin();
        antiprism.getContacts(utils.displayContacts);
        antiprism.getStatus(utils.setHeadline);
      } else {
        $('#loginAlert').fadeIn(1000,function(){setTimeout(function(){$('#loginAlert').fadeOut()},5000)})
      }
      $('#password').val("");
    }
    if(registration)
      antiprism.register(callback)
    else
      antiprism.login(callback)
  },
  logout: function() {
    antiprism.close();
    $('h1').text(headline);
    $('#messages').text("");
    utils.switchChatLogin();
  },
  
}