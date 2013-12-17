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
 *    - !!remove contact: * bootbox prompt autocompletion
 *                        * confirmation ("are you sure you want to delete X?")
 *
 *    - !!show more messages: * button which get more messages?
 *                            * number of messages to retrieve: $('#messages').children().length
 *                            * easy way: just empty messagefield and load the messages again + around 20
 *                            * better way: load only older messages and display them in front of the others
 *
 *    - !!!display error messages: * error message sliding down next to the headline?
 *
 *    - !Work with the localstorage (e.g. save mute-setting)
 *
 *    - !!!onConncetionClose: show a windows that says smthg like "server disconnected - reload?"
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
  removeContactPrompt: function() {
    bootbox.prompt("What Contact do you want to remove?", function(result) {
      if(result !== null)
        antiprism.removeContact(result, function() {
          console.log("Succesfully removed contact: " + result);
          antiprism.getContacts(utils.displayContacts);
        })
    });
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
      var contactElement = document.createElement("a");
      var icon = document.createElement("span");
      var status = document.createElement("small");
      icon.className = "online";
      contactElement.href = "#";
      contactElement.className = "list-group-item";
      contactElement.appendChild(icon);
      contactElement.innerHTML += contact;
      contactElement.id = contact;
      contactElement.addEventListener("click",function(ctx) {
        var contactName = ctx.target.id || ctx.target.parentNode.id;
        utils.onContactSelect(contactName);
      });
      status.innerHTML = msg.contacts[contact].status;
      contactElement.appendChild(status);
      contactList.appendChild(contactElement);
    }
    if($('.active').length)
      var formerSelectedContact = $('.active')[0].id;
    friendList.text("");
    friendList.append(contactList);
    for(var contact in msg.contacts) {
      utils.displayOnline({user:contact,online:msg.contacts[contact].online});
    }
    if(formerSelectedContact)
      $('#'+formerSelectedContact).addClass("active");
    utils.addFriendsPopover(Object.keys(msg.contacts).length);
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
    client.getMessages(contactName);
  },
  displayMessage: function(message, chained) {
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
      panelContent.textContent = message.msg;
      var urlregex = /(\b(https?):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig,
          results = panelContent.innerHTML.match(urlregex);
      for(link in results) {
        var replaced = panelContent.innerHTML.replace(results[link],results[link].link(results[link]));
        panelContent.innerHTML = replaced.replace("<a","<a target=_blank");
      }
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
      if(!chained)
        utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
    } else {
      $('#'+contactName).addClass("newMessage");
    }
    if(!document.hasFocus())
      $('title').text("#AP - " + contactName + " just contacted you!");
  },
  statusIcon: function() {
    var statusIcon = document.createElement("span");
    statusIcon.className = "glyphicon glyphicon-ok-sign online";
    return statusIcon;
  },
  displayOnline: function(msg) {
    var $user = $('#'+msg.user);
    if(msg.online)
      $user.children()[0].className = "glyphicon glyphicon-ok-sign online";
    else if (!msg.online)
      if($user.children()[0].className != "glyphicon")
        $user.children()[0].className = "glyphicon";
  },
  displayMessages: function(msg) {
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
        console.log("Did not added contact " + friend);
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
      error: antiprism.debug,
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