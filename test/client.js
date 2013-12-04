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
  messageDisplay: $('#messages'),
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
    utils.messageDisplay.text("");
    client.getMessages(contactName);
  },
  displayMessage: function(message) {
    //console.log(message);
    var messageContainer = document.createElement("p");
    var username = message.from || utils.getUsername();
    var time = (new Date(message.ts)).toLocaleString().split(' ')[1];
    messageContainer.innerText = '<' + time + '> ' + username + ': ' + message.msg;
    utils.messageDisplay.append(messageContainer);
    utils.messageDisplay.animate({ scrollTop: utils.messageDisplay.prop("scrollHeight") - utils.messageDisplay.height() }, 500);
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
    var username = utils.getUsername();
    var password = utils.getPassword();
    var registration = utils.register();

    utils.switchLoginAbility();
    antiprism.init(username, password,0,0,{msg:utils.displayMessage,error:antiprism.debug});

    var callback = function() {
      utils.switchChatLogin();
      antiprism.getContacts(utils.displayContacts);
    }
    if(registration)
      antiprism.register(callback)
    else
      antiprism.login(callback)
  },
  
}

