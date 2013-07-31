# Client to Server

## Server Error Object
	{"error": <ERROR_CODE>}
0. \[Success\]
1. Invalid action
2. Invalid username
3. Invalid key
4. Invalid conversation ID
5. Unknown server
6. Unknown user


## Login
	{"action": "login", "user": "<YOUR_USERNAME>"}
###Server Response
	{"privateKey": "<ENCRYPTED_PRIVATE_KEY>", "publicKey": "<PUBLIC_KEY>", "encryptedValidationKey": "<ENCRYPTED_VALIDATION_KEY>"}
###Error Codes: 2

##Authentication
	{"action": "auth", "validationKey": "<DECRYPTED_VALIDATION_KEY>"}
###Server Response
	{}
###Error Codes: 3


## Authenticated messages:

##Add user
	{"action": "addUser", "address": "<USER_ADDRESS>}
###Server Response
	{"userId": "<USER_ID>", "publicKey": "<PUBLIC_KEY>", "name":"<USERNAME>"}
###Error Codes: 5, 6

##Remove user
	{"action": "removeUser", "userId": "<USER_ID>}
###Server Response
	{}
###Error Codes: 6

##Retrieve contacts
	{"action": "contactList"}
###Server Response
	{"<USER_ID>": {"address": "<USER_ADDRESS", "u": "<USER_NAME>"}}

##Sending messages
	{"action": "send", "message": "<ENCRYPTED_MESSAGE>", "conversationId": "<CONVERSATION_ID>"}
###Server Response
	{"timestamp": "<TIMESTAMP>"}
###Error Codes: 4


#Server to Client:

