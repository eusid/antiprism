antiprismSDK.js
=================

###Basic Facts  
 * 100% Callback-Based
 * WebSockets (optional TLS) behind -> Realtime \o/
 * abstracting from the Crypto-mechanisms completely (nearly)

### Methods  

####Initialisation  
    antiprism.init(username,password,callbacks);  
where `callbacks` is a dictionary, holding a few initial callback-functions:

    callbacks = {
        error: function(code) {},
        /* called when server returns error.
            "code" is an error-code, yet to be documented :D
        */
        msg: function(msg, from, to, timestamp) {},
        /* on new message.
            msg is already decoded for you
            if this is a session-broadcast, "to" will be set,
            otherwise it's undefined.
        */
        online: function(user, online) {},
        /* on friend coming online / going offline.
            "online" is a bool, indicating what just happened.
        */
        added: function(user, msg) {},
        /* called when user is added by another user,
            requesting authorization
        */
    }
    
####Registration
    antiprism.register(function(registered) {});
where `register` is a boolean indicating success or failure

####Login
    antiprism.login(function(loggedIn, contacts) {});
where `loggedIn` is a boolean like `registered`,
`contacts` is an array of dictionaries, each with the properties `user` and the according `online`-boolean

####Retrieving Contacts
    
