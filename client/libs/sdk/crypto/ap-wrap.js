(function(){
RSAKey.prototype.getPrivate = function() {
	var params = ["d","p","q","dmp1","dmq1","coeff"],
      val;
	for(var x in params) {
    val = this[params[x]].toString(16);
    params[x] = (val.length % 2) ? '0'+val : val;
  }
  return new Buffer(params.join(""),'hex').toString('base64');
}

RSAKey.prototype.getPublic = function() {
	var params = ["n","e"], val;
  for(var x in params) {
    val = this[params[x]].toString(16);
    params[x] = (val.length % 2) ? '0'+val : val;
  }
  return new Buffer(params.join(""),'hex').toString('base64');
}

RSAKey.prototype.loadPublic = function(pubkey, bits) {
	var hex = new Buffer(pubkey,'base64').toString('hex'),
      length = bits/4;
	this.setPublic(hex.substr(0,length),hex.substr(length));
}

RSAKey.prototype.loadPrivate = function (pubkey, privkey, bits) {
	this.loadPublic(pubkey, bits);
	var hex = new Buffer(privkey,'base64').toString('hex'),
		length = bits/4,
		params = [this.n.toString(16),this.e.toString(16),hex.substr(0,length)],
	  hex = hex.substr(length),
    length = hex.length / 5;
	for(var i=0; i < 5; i++)
    params.push(hex.substr(i*length,length));
	this.setPrivateEx.apply(this,params);
}})();
