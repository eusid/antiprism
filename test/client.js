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
  enterKeyEvents: function(loginFunction, sendMessageFunction) {
    $('#login').find(".textField").keyup(function(e){
      if(e.keyCode == 13) {
          loginFunction();
      }
    });
    $('#messageField').keyup(function(e){
      if(e.keyCode == 13) {
          sendMessageFunction();
      }
    });
  },
}

var client = {
  init: function() {
    function login() {
      var username = utils.getUsername();
      var password = utils.getPassword();
      var registration = utils.register();

      utils.switchLoginAbility();
      antiprism.init(username, password,0,0,{msg:antiprism.debug,error:antiprism.debug});

      var callback = function() {
        utils.switchChatLogin();
        antiprism.getContacts();
      }
      if(registration)
        antiprism.register(callback)
      else
        antiprism.login(callback)
    }

    utils.enterKeyEvents(login, sendMessage);

    $('#registration')[0].onclick = utils.changeButton;
    $('#signInButton')[0].onclick = login;
    $('#addFriendButton')[0].onclick = addFriend;
    $('#sendButton')[0].onclick = sendMessage;

  }
}

