$(document).ready(function () {
  client.init();
});

function addFriend(){console.log("addFriend() worked!");}
function sendMessage(){console.log("sendMessage() worked!");}


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
  register: function() {
    return $('#registration').prop('checked');
  },
  setOnClickEvents: function() {
    $('#registration')[0].onclick = utils.changeButton;
    $('#signInButton')[0].onclick = client.login;
    $('#addFriendButton')[0].onclick = addFriend;
    $('#sendButton')[0].onclick = sendMessage;
  },
  enterKeyEvents: function(sendMessageFunction) {
    $('#login').find(".textField").keyup(function(e){
      if(e.keyCode == 13) {
          client.login();
      }
    });
    $('#messageField').keyup(function(e){
      if(e.keyCode == 13) {
          sendMessageFunction();
      }
    });
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
    var messageDiv = $('#messages');
    messageDiv.text("");
    antiprism.getMessages(contactName, -10, -1, utils.displayMessages);
  },
  displayMessages: function(msg) {
    console.log(msg);
  },
}

var client = {
  init: function() {
    utils.enterKeyEvents(sendMessage);
    utils.setOnClickEvents();
  },
  login: function() {
    var username = utils.getUsername();
    var password = utils.getPassword();
    var registration = utils.register();

    utils.switchLoginAbility();
    antiprism.init(username, password,0,0,{msg:antiprism.debug,error:antiprism.debug});

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

