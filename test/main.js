ws = new WebSocket("ws://localhost:8080");

function hex2a(hex) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function parseLatin(string) {
  return CryptoJS.enc.Latin1.parse(string);
}

function utf8_b64enc(string) {
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(string));
}

function utf8_b64dec(string) {
  return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(string));
}

function decryptAES(cipher, key) {
  cipher = atob(cipher);
  var iv = parseLatin(cipher.substring(0,16));
  var cipher = parseLatin(cipher.substring(16));
  var key = parseLatin(key);
  var decrypted = CryptoJS.AES.decrypt({ciphertext:cipher},key,{iv:iv});
  return CryptoJS.enc.Utf8.stringify(decrypted);
}

function encryptAES(string, key) {
  var key = parseLatin(key);
  var iv = parseLatin(rng_get_string(16));
  var cipher = CryptoJS.AES.encrypt(string, key, { iv: iv });
  return btoa(hex2a(cipher.iv+cipher.ciphertext));
}

function buildAESKey(password) {
  var salt = "i_iz_static_salt";
  var hash = scrypt.crypto_scrypt(scrypt.encode_utf8(password),scrypt.encode_utf8(salt), 16384, 8, 1, 32)
  return String.fromCharCode.apply(null, new Uint8Array(hash));
}

function generateKeypair() {
  var rsa = new RSAKey();
  rsa.generate(2048,"10001");
  var pubkey = {};
  pubkey.n = rsa.n.toString(16);
  pubkey.e = rsa.e.toString(16);
  return {pubkey: pubkey, privkey: rsa.d.toString(16)};
}

function encryptRSA(plain, pubkey) {
  var rsa = new RSAKey();
  rsa.setPublic(pubkey.n, pubkey.e);
  return rsa.encrypt(plain);
}

function decryptRSA(cipher, pubkey, privkey) {
  var rsa = new RSAKey();
  rsa.setPrivate(pubkey.n, pubkey.e, privkey);
  return rsa.decrypt(cipher);
}

function register() {
  console.log("# # # Registration # # #");

  keypair = generateKeypair();
  keypair.crypt = encryptAES(keypair.privkey, ws.user.password);
  ws.sendObject({action:"register", username:ws.user.name, pubkey:keypair.pubkey, privkey:keypair.crypt});
  console.log("Registrationprocess completed.");
  login();
}

function login() {
  console.log("# # # Login # # #")
  ws.sendObject({action:"login","username":ws.user.name});
}

function sendMessage() {
  var messageField = $('#messageField');
  var msg = messageField.val();
  messageField.val("");
  var to = $('select').val();
  ws.sendMessage(to, msg);
  displayMessage(msg, ws.user.name, $('#messages'));
}

function switchChatLogin() {
  $('#login').toggle(1000);
  $('#chat').toggle(1000);
}

function displayContacts(contacts) {
  var friendList = $('#friendList');
  var contactList = document.createElement("select");
  contactList.size = 2; //sizeproperty has to be set because fuck that shit
  contactList.addEventListener("change",onContactChange);

  for (contact in contacts) {
    var label = document.createElement("option");
    label.innerText = contact;
    contactList.appendChild(label);
  }
  friendList.append(contactList);
}

function displayMessage(message, from, messageDisplay) {
  var messageContainer = document.createElement("p");
  messageContainer.innerText = from + ': ' + message;
  messageDisplay.append(messageContainer);
  messageDisplay.animate({ scrollTop: messageDisplay.prop("scrollHeight") - messageDisplay.height() }, 500);
}

function displayMessages(messages) {
  var from = $('select').val();
  if(!ws.user.conversations[from]) {
    ws.getKey(from);
    ws.msgqueue = ws.msgqueue.concat(messages);
    return false;
  }
  var messageDisplay = $('#messages');
  for(message in messages) {
      var plain = ws.decryptmsg({from:from, msg:messages[message].msg});
      displayMessage(plain, messages[message].from, messageDisplay);
  }
  
  return true; 
}

function onContactChange (ctx) {
  var contactName = ctx.target.value;
  var messageDiv = $('#messages');
  messageDiv.text("");
  ws.sendObject({action:"retrieveMessages",user:contactName,start:-10,end:-1});
}

function initWS() {
  var username = $('#username').val();
  var password = $('#password').val();
  var registration = $('#registration').prop('checked');
  var user = {name:username, password: buildAESKey(password), conversations:{}};

  var msgqueue = [];
  ws.msgqueue = msgqueue;
  ws.user = user;

  ws.decryptmsg = function(msg) {
    //console.log(msg);
    if(ws.user.conversations[msg.from])
      return decryptAES(msg.msg, ws.user.conversations[msg.from]);
    else
      return false;
  };
  ws.sendMessage = function(username,msg) {
    if(!ws.user.conversations[username])
     return "get key first!";
    ws.sendObject({action:"storeMessage",user:username,msg:encryptAES(msg,ws.user.conversations[username])});
  };
  ws.getKey = function(username) {
    ws.sendObject({action:"conversationKey",user:username});
  };
  ws.sendObject = function(msg) { ws.send(JSON.stringify(msg)); };
  ws.onopen = function() {
    if (registration) {
      register();
    } else {
      login();
    }
   }
  ws.onmessage = function(msg) {
    try {
      var response = JSON.parse(msg.data);
    } catch(e) {
      console.log("tried to parse:"+msg.data+", encountered:");
      console.log(e);
    }
     console.log('[debug] received obj:');
     console.log(response);

    if(response.registered !== undefined) { // context: after registration
      if(response.registered)
        ws.sendObject({action:"login","username":ws.user.name});
      else
        alert("username already taken!");
        switchChatLogin();
    }
    else if(response.validationKey) { // context: login
      ws.user.pubkey = response.pubkey;
      try {
        var privkey = decryptAES(response.privkey,ws.user.password);
        ws.user.privkey = privkey;
        var validationKey = decryptRSA(response.validationKey, response.pubkey, privkey);
        ws.sendObject({action:"auth","validationKey":utf8_b64enc(validationKey)}); 
      } catch (e) {
        ws.user = null;
        alert("wrong password");
      }
    }
    else if(response.convkey !== undefined) { // context: asked for conversationkey
      if(response.convkey == null)
        ws.sendObject({action:"pubkey",user:response.user});
      else {
        ws.user.conversations[response.user] = decryptRSA(response.convkey,ws.user.pubkey,ws.user.privkey);
        displayMessages(ws.msgqueue);
      }
    }
    else if(response.pubkey) { // context: wants to create/encrypt conversationkey
      if(!response.pubkey.n) {
        alert("User not found!");
        return;
      }
      var conversationkey = rng_get_string(32);
      keys = [];
      keys.push(encryptRSA(conversationkey, ws.user.pubkey));
      keys.push(encryptRSA(conversationkey, response.pubkey));
      ws.user.conversations[response.user] = conversationkey;
      ws.sendObject({action:"initConversation",convkeys:keys,user:response.user});
    }
    else if(response.msg) { // received msg, no clue yet if necessary keys are present
      if(response.from == $('select').val()) {
        var message = ws.decryptmsg(response);
        displayMessage(message, response.from, $('#messages'));
      }
    }
    else if(response.contacts) {
      displayContacts(response.contacts);
    }
    else if(response.msglist) {
      displayMessages(response.msglist);
    }
    else if(response.success) {
      switchChatLogin();
      ws.sendObject({action:"contacts"});
    }
  };
  if (registration) {
      register();
  } else {
      login();
  }
  return ws;  
}

function demo() {
  /* situation: A and B want to register with the service with passwords "omgpassword" and "wtfrofl" */
  var A = {};
  A.keypair = generateKeypair();
  console.log("generated A's keypair!");
  A.encryptedPrivKey = encryptAES(A.keypair.privkey, buildAESKey("omgpassword"));
  console.log("...and encrypted it!");
  var B = {}
  B.keypair = generateKeypair();
  console.log("generated B's keypair!");
  B.encryptedPrivKey = encryptAES(B.keypair.privkey, buildAESKey("wtfrofl"));
  console.log("...and encrypted it!");



  // what happens next: keypairA.pubkey and base64(A.encryptedPrivKey) get sent to the server (same for B)

  /* login check is as following: server encrypts random string (e.g. "wurstbrot") with stored pubkey
      and sends the encrypted string + encryptedPrivKey back to the client
  */
  var ServerString = encryptRSA("wurstbrot", A.keypair.pubkey);
  var receivedPrivKey = decryptAES(A.encryptedPrivKey, buildAESKey("omgpassword"));
  var decryptedString = decryptRSA(ServerString, A.keypair.pubkey, receivedPrivKey);
  console.log("Decrypted received string to '"+decryptedString+"'");
  // client sent back the correct string, so he obviously has the right pw to decrypt his privkey -> logged in

  /* initiating a conversation:
    1) generate a random conversation-key (AES)
    2) encrypt key with both own & conversationpartner's pubkey(s)
          (since they are logged in, the can obviously decrypt it)
    3) save both encrypted keys for the conversation on the server
  */
  var conversationkey = rng_get_string(32);
  A.convkey = encryptRSA(conversationkey, A.keypair.pubkey);
  B.convkey = encryptRSA(conversationkey, B.keypair.pubkey);

  // sending a message: simple encrypt it with conversationkey and store on server!
  var message = "oh mein gott, das ist derbe secret!";
  var encryptedMessage = encryptAES(message, conversationkey);

  //receiving a message: decrypt the conversationkey first (once per session), then decrypt the message
  conversationkey = decryptRSA(B.convkey, B.keypair.pubkey, B.keypair.privkey);
  var decryptedMessage = decryptAES(encryptedMessage, conversationkey);
  return decryptedMessage;
} 