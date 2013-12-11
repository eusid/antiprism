$(document).ready(function () {
  client.init();
});

var utils = {
  switchLoginAbility: function() {
    var loginClass = $('.login');
    loginClass.attr("disabled",!loginClass[0].disabled);
  },
  switchChatLogin: function() {
    $('#login').toggle(1000);
    $('#chat').toggle(1000);
  },
  changeButton: function() {
    if($('#registration').prop('checked')) {
      $('button')[0].innerText = "Sign Up";
    } else {
      $('button')[0].innerText = "Sign In";
    }
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
    $('#registration')[0].onclick = utils.changeButton;
    $('#signInButton')[0].onclick = client.login;
    $('#addFriendButton')[0].onclick = client.addFriend;
    $('#sendButton')[0].onclick = client.sendMessage;
  },
  enterKeyEvents: function() {
    $('#login').find(".textField").keyup(function(e){
      if(e.keyCode == 13) {
          client.login();
      }
    });
    $('#messageField').keyup(function(e){
      if(e.keyCode == 13) {
          client.sendMessage();
      }
    });
    $('#addFriendField').keyup(function(e){
      if(e.keyCode == 13) {
        client.addFriend();
      }
    })
  },
  displayContacts: function(msg) {
    console.log(msg);
    var friendList = $('#friendList');
    var ul = document.createElement("ul");
     for (var contact in msg.contacts) {
      var li = document.createElement("li");
      var nameDiv = document.createElement("div");
      var iconDiv = document.createElement("div");
      nameDiv.innerText = contact;
      nameDiv.className = "contactDiv";
      iconDiv.className = "iconDiv";
      li.appendChild(nameDiv);
      li.appendChild(iconDiv);
      li.className = "contactList";
      li.addEventListener("click",utils.onContactSelect);
      ul.appendChild(li);
     }
     friendList.text("");
     friendList.append(ul);
     for(var contact in msg.contacts) {
      console.log("displaying onlinestatus from user: " + contact);
      console.log(msg.contacts[contact]);
      utils.displayOnline({user:contact,online:msg.contacts[contact].online})
     }

  },
  onContactSelect: function(ctx) {
    var helper = function(contactName) {
      var contactNode = utils.getContactByName(contactName);
      $('.active').removeClass("active");
      contactNode.classList.add("active");
      if(contactNode.className.indexOf("newMessage") != -1)
        contactNode.classlist.remove("newMessage");
      utils.messageDisplay().empty();
      client.getMessages(contactName);
    }

    try {
      var contactName = ctx.toElement.childNodes[0].data;
      helper(contactName);
      
    } catch (e) {
      try {
        console.log(ctx);
        var contactName = ctx.toElement.parentNode.previousElementSibling.innerText;
        helper(contactName);
      } catch (e) {
        var contactName = ctx.toElement.childNodes[0].innerText;
        helper(contactName);
      }
    }
  },
  getContactByName: function(contactName) {
    var containsString = ":contains(" + contactName + ")";
    var contacts = $('li').filter(containsString);

    if (contacts.length == 1)
      return contacts[0];
    for (var i in contacts) {
      if(contacts[i].innerText == contactName) 
        return contacts[i]
    }
  },
  displayMessage: function(message) {
    console.log(message);
    var selectedContact = $('select').val();
    if (selectedContact == message.from || selectedContact == message.to || utils.getUsername() == message.from) {
      var messageContainer = document.createElement("p");
      var username = message.from || utils.getUsername();
      var time = (new Date(message.ts)).toLocaleString().split(' ')[1];
      messageContainer.innerText = '<' + time + '> ' + username + ': ' + message.msg;
      utils.messageDisplay().append(messageContainer);
      utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 500);
    } else {
      var contact = utils.getContactByName(message.from || message.to);
      contact.className = "newMessage";
    }
  },
  statusIcon: function() {
    var statusIcon = document.createElement("img");
    statusIcon.width = 12;
    statusIcon.height = 12;
    statusIcon.alt = "online";
    statusIcon.src = "https://fbstatic-a.akamaihd.net/rsrc.php/v2/y4/r/-PAXP-deijE.gif";
    statusIcon.className = "icon";
    return statusIcon;
  },
  displayOnline: function(msg) {
    console.log(msg);
    var user = utils.getContactByName(msg.user);
    if(msg.online)
      user.children[1].appendChild(utils.statusIcon());
    else if (!msg.online)
      if(user.children[1].children[0] !== undefined)
        user.children[1].children[0].remove();
  },
  displayMessages: function(msg) {
    for(var i in msg.msglist) {
      utils.displayMessage(msg.msglist[i]);
    }
  },
  playSound: function(mp3, fallback) {
    var sound = new Audio();
    sound.src = sound.canPlayType("audio/mpeg")?mp3:fallback;
    sound.play();
  }
}

var client = {
  init: function() {
    utils.enterKeyEvents();
    utils.setOnClickEvents();
  },
  getMessages: function(contactName) {
    antiprism.getMessages(contactName, -10, -1, utils.displayMessages);
  },
  sendMessage: function() {
    var messageField = $('#messageField');
    var message = messageField.val();
    var to = $('.active').children()[0].innerText;

    messageField.val('');
    antiprism.sendMessage(to, message, function(msg) {
        utils.displayMessage({to:to,ts:msg.ts,msg:message});
    });
  },
  addFriend: function() {
    antiprism.initConversation($('#addFriendField').val(), function() {
      antiprism.getContacts(utils.displayContacts);
    });
  },
  login: function() {
    utils.switchLoginAbility();
    var username = utils.getUsername();
    var password = utils.getPassword();
    var registration = utils.register();

    var host = location.origin.replace(/^http/, 'ws');
    antiprism.init(username, password,host, {
      msg: function(msg) {
        var selected = $('.active').children()[0].innerText;
        if(!msg.to && (msg.from != selected || !document.hasFocus())) {
          if(!$('#muteButton')[0].checked)
            utils.playSound("ios.mp3");
          if(selected != msg.from)
            utils.getContactByName(msg.from).classList.add("newMessage");
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
        $('h1')[0].innerText = $('h1')[0].innerText + " (" + utils.getUsername() + ")";
        utils.switchChatLogin();
        antiprism.getContacts(utils.displayContacts);
      } else utils.switchLoginAbility();
    }
    if(registration)
      antiprism.register(callback)
    else
      antiprism.login(callback)
  },
  
}

