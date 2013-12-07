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
    var contactList = document.createElement("select");
    contactList.size = 2; //sizeproperty has to be set because fuck that shit
    contactList.addEventListener("change",utils.onContactChange);

    for (contact in msg.contacts) {
      var label = document.createElement("option");
      label.innerText = contact;
      contactList.appendChild(label);
    }
    friendList.text("");
    friendList.append(contactList);
  },
  onContactChange: function(ctx) {
    var contactName = ctx.target.value;
    utils.messageDisplay().text("");
    utils.getContactByName(contactName).className = "";
    client.getMessages(contactName);
  },
  getContactByName: function(contactName) {
    var containsString = ":contains(" + contactName + ")";
    var contacts = $('option').filter(containsString);

    if (contacts.length == 1)
      return contacts[0];
    for (i in contacts) {
      if(contacts[i].innerText == x) return contacts[i]
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
  displayMessages: function(msg) {
    for(i in msg.msglist) {
      utils.displayMessage(msg.msglist[i]);
    }
  },
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
    var to = $('select').val();

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
        utils.displayMessage(msg);
      },
      error: antiprism.debug,
      online: antiprism.debug,
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

