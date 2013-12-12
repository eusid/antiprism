$(document).ready(function () {
  client.init();
  $('form').submit(function(e) {e.preventDefault(); });
});

var utils = {
  setHeadline: function(msg) {
    var statusMsgContainer = document.createElement("blockquote");
    var statusMsg = document.createElement("small");
    statusMsg.innerHTML = msg.status;
    $h1 = $('h1');
    $h1.text(headline + " (" + utils.getUsername() + ") ");
    $h1.append(statusMsg);
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
    $('#setStatusButton').click(function() {
      bootbox.prompt("What's up?", function(result) {                
        if (result !== null) {                                             
          client.setStatus(result);                              
        }
      });
    });
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
          $('#savePassButton').prop("disabled", false)
        }
      }
      validate();
      $('#newPassField').keyup(validate);
    })
  },
  displayStatus: function(contactName, statusMsg) {
    utils.getContactByName(contactName);
    console.log(contactName);
    console.log(statusMsg);
  },
  createStatusTooltip: function(status) {
    var tooltipDiv = document.createElement("div");
    var tooltipInner = document.createElement("div");
    var tooltipArrow = document.createElement("div");

    tooltipDiv.className = "tooltip";
    tooltipInner.className = "tooltip-inner";
    tooltipInner.innerHTML = status;
    tooltipArrow.className = "tooltip-arrow";
    tooltipDiv.appendChild(tooltipInner);
    tooltipDiv.appendChild(tooltipArrow);

    return tooltipDiv;
  },
  displayContacts: function(msg) {
    console.log(msg);
    var friendList = $('#friendList');
    var contactList = document.createElement("div");
    contactList.className = "list-group";
    for (var contact in msg.contacts) {
      var contactElement = document.createElement("a");
      var icon = document.createElement("span");
      icon.className = "online";
      contactElement.href = "#";
      contactElement.className = "list-group-item";
      //contactElement.title = msg.status;
      contactElement.appendChild(icon);
      contactElement.innerHTML += contact;
      //contactElement.appendChild(utils.createStatusTooltip(msg.contacts[contact].status));
      contactElement.addEventListener("click",function(ctx) {
        console.log(ctx);
        if(ctx.toElement === undefined)
          var contactName = ctx.target.text;
        else 
          var contactName = ctx.toElement.innerText;
        utils.onContactSelect(contactName);
      });
      contactList.appendChild(contactElement);
    }
    friendList.text("");
    friendList.append(contactList);
    for(var contact in msg.contacts) {
      var statusMsg = msg.contacts[contact].status || "";
      console.log("status: " + statusMsg);
      utils.displayOnline({user:contact,online:msg.contacts[contact].online});
      var statusTitle = contact + "'s status: ";
      var containsString = ":contains(" + contact + ")";
      $('a.list-group-item').filter(containsString).popover(
        {trigger:'hover',content:statusMsg, 
        title:statusTitle, delay: { show: 500, hide: 100 }})
      .removeAttr("data-original-title").removeAttr("title");
    }
  },
  onContactSelect: function(contactName) { 
    console.log(contactName);    
    var contactNode = utils.getContactByName(contactName);
    console.log(contactNode);
    $('.active').removeClass("active");
    contactNode.classList.add("active");
    if(contactNode.className.indexOf("newMessage") != -1)
      contactNode.classList.remove("newMessage");
    console.log(contactNode);
    utils.messageDisplay().empty();
    client.getMessages(contactName);
  },
  getContactByName: function(contactName) {
    var containsString = ":contains(" + contactName + ")";
    var $contacts = $('a.list-group-item').filter(containsString);
    console.log($contacts);

    //Firefox
    if($contacts.text() == contactName)
      return $contacts[0];

    //Chrome
    if ($contacts.length == 1 && $contacts[0] != undefined)
      return $contacts[0];
    for (var i in $contacts) {
      if($contacts[i].innerText == contactName) 
        return $contacts[i]
    }
    throw "contact " + contactName + " not found :/";
  },
  displayMessage: function(message, chained) {
    if(!document.hasFocus())
      $('title').text("#AP - " + contactName + " just contacted you!");
    var $active = $('.active');
    console.log(message);
    var selectedContact = "";
    if ($active.length)
      var selectedContact = $active.text();
    var contactName = message.from || message.to;
    console.log("selectedContact: " + selectedContact);
    if (selectedContact == message.from || selectedContact == message.to || utils.getUsername() == message.from) {
      var panelContainer = document.createElement("div");
      var panelHeader = document.createElement("div");
      var panelContent = document.createElement("div");
      var username = message.from || utils.getUsername();
      var time = (new Date(message.ts)).toLocaleTimeString().split(' ');
      panelHeader.className = "panel panel-heading";
      panelContent.className = "panel panel-body";
      panelContent.innerHTML = message.msg;
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
      var contact = utils.getContactByName(contactName);
      contact.classList.add("newMessage");
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
    console.log(msg);
    var user = utils.getContactByName(msg.user);
    globaluser = user;
    if(msg.online)
      user.children[0].className = "glyphicon glyphicon-ok-sign online";
    else if (!msg.online)
      if(user.children[0].className != "glyphicon")
        user.children[0].className = "glyphicon";
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
      to = $active.text();
    console.log(to);
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
    antiprism.setStatus(statusMsg, function() {});
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