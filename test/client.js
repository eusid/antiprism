$(document).ready(function () {
  client.init();
  $('form').submit(function(e) {e.preventDefault(); });
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
      var clickDiv = document.createElement("div");
      nameDiv.innerText = contact;
      nameDiv.className = "contactDiv";
      iconDiv.className = "iconDiv";
      clickDiv.className = "clickDiv";
      clickDiv.id = contact;
      clickDiv.addEventListener("click",function(ctx) {
        var className = ctx.toElement.className;
        if(className == "clickDiv")
          utils.onContactSelect(ctx.toElement.id);
        else if(className == "contactDiv" || ctx.toElement.className == "iconDiv")
          utils.onContactSelect(ctx.toElement.parentNode.id);
        else if(className == "icon")
          utils.onContactSelect(ctx.toElement.parentNode.parentNode.id)
      });
      clickDiv.appendChild(nameDiv);
      clickDiv.appendChild(iconDiv);
      li.appendChild(clickDiv);
      li.className = "contactList";
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
  onContactSelect: function(contactName) {     
    var contactNode = utils.getContactByName(contactName);
    $('.active').removeClass("active");
    contactNode.classList.add("active");
    if(contactNode.className.indexOf("newMessage") != -1)
      contactNode.classList.remove("newMessage");
    utils.messageDisplay().empty();
    client.getMessages(contactName);
  },
  getContactByName: function(contactName) {
    var containsString = ":contains(" + contactName + ")";
    var contacts = $('li').filter(containsString);

    if (contacts.length == 1 && contacts[0] != undefined)
      return contacts[0];
    for (var i in contacts) {
      if(contacts[i].innerText == contactName) 
        return contacts[i]
    }
    throw "contact " + contactName + " not found :/";
  },
  displayMessage: function(message) {
    if(!document.hasFocus())
      $('title').text("#AP - " + contactName + " just contacted you!");
    var $active = $('.active');
    var selectedContact = null;
    if ($active.length)
      var selectedContact = $active.children()[0].innerText;
    var contactName = message.from || message.to;
    if (selectedContact == message.from || selectedContact == message.to || utils.getUsername() == message.from) {
      var messageContainer = document.createElement("p");
      var username = message.from || utils.getUsername();
      var time = (new Date(message.ts)).toLocaleTimeString().split(' ');
      messageContainer.innerText = '<' + time + '> ' + username + ': ' + message.msg;
      utils.messageDisplay().append(messageContainer);
      utils.messageDisplay().animate({ scrollTop: utils.messageDisplay().prop("scrollHeight") - utils.messageDisplay().height() }, 300);
    } else {
      var contact = utils.getContactByName(contactName);
      contact.classList.add("newMessage");
    }
    if(!document.hasFocus())
      $('title').text("#AP - " + contactName + " just contacted you!");
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
    var user = utils.getContactByName(msg.user).children[0];
    globaluser = user;
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
    if (!message)
      return;
    var to = null;
    var $active = $('.active');
    if ($active.length)
      to = $active.children()[0].innerText;
    console.log(to);
    messageField.val('');
    if(to)
      antiprism.sendMessage(to, message, function(msg) {
          utils.displayMessage({to:to,ts:msg.ts,msg:message});
      });
    else
      utils.displayMessage({to:null,ts:(new Date()).getTime(),msg:"Fotze du hast keinen fucking Kontakt ausgewaehlt!!"});
  },
  addFriend: function() {
    var friend = $('#addFriendField').val();
    if (!friend)
      return;
    antiprism.initConversation(friend, function() {
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
        var $active = $('.active');
        var selected = null;
        if ($active.length)
          selected = $active.children()[0].innerText;
        if(!msg.to && (msg.from != selected || !document.hasFocus())) {
          if(!$('#muteButton')[0].checked)
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

