#Client to Server

##Server Error Object
	{"error": "<description>", code:<id>}
0. \[Success\] (is not sent back to client)
1. Missing action
2. Invalid username
3. Invalid Action
3. Invalid key
4. Invalid conversation ID
5. Unknown server
6. Unknown user

##Unauthenticated messages:

###Login-Request - implemented
	{"action": "login", "username": NAME}
Server Response

	{"validationKey": .., "pubkey": ..., "privkey": ...}

###Authentication - implemented
	{"action": "auth", "validationKey": ...}
Server Response

	ERROR || {loggedIn: true};


##Authenticated messages:

###Get Pubkey - implemented
	{"action": "pubkey", "user": NAME}
Server Response

	{"user":NAME,"pubkey":PUBKEY}

###Initiate Conversation - implemented
	{"action": "initConversation", "user": NAME, convkeys:[OWN_KEY,TARGETS_KEY]}
Server Response

	{"initiated":false|true, "with":USER} (false if already initiated before)

###Remove user - not yet implemented
	{"action": "removeUser", "user": NAME}
Server Response

	{"deleted": USER}

###Get single conversationkey - implemented
	{"action":"conversationKey","user":NAME}
Server Response
	
	{"user": USER, "convkey":CONVERSATION_KEY}
	(convkey is null if it doesn't exist, you should initiate first)

###Retrieve contactlist - implemented
	{"action": "contacs"}
Server Response

	{"contacts": [{USER: ENCRYPTED_CONVERSATIONKEY},...]}

###Sending messages - implemented
	{"action": "storeMessage", "msg": ENCRYPTED_MESSAGE, "user": NAME}
Server Response

	- none, but message gets broadcasted to other active sessions -

#Server to Client:
###Received new message
	{"ts":TIMESTAMP, "from":NAME, "msg":ENCRYPTED_MESSAGE}
