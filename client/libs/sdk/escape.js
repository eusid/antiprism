define(function () {
    // lookup-tables
    var hex = "0123456789ABCDEF",
        ascii = {};
    for(var i=0; i < 256; i++)
        ascii[String.fromCharCode(i)] = i;

    function Escaper(chars, prefix, allowNonPrintable) {
        chars = chars === undefined ? [] : chars.split("").map(
            function(x) { return x.charCodeAt(0);
        });
        this.prefix = prefix === undefined ? "%" : prefix;
        this.escaped = [0,0,0,0,0,0,0,0];
        if(!allowNonPrintable) {
            this.escaped[0] = this.escaped[4] = this.escaped[5]
              = this.escaped[6] = this.escaped[7] = -1;
            this.escaped[3] = 1 << 31; // escape 0x7f -> DEL
        }
        chars.push(this.prefix.charCodeAt(0));
        for(var i in chars)
            this.escaped[chars[i] >> 5] |= 1 << (chars[i] & 0x1f);
    }
    Escaper.prototype.escape = function(str) {
        var ret = "";
        for(var i = 0; i < str.length; i++) {
            var chr = ascii[str[i]];
            if (this.escaped[chr >> 5] & (1 << (chr & 0x1f)))
                ret += this.prefix+hex[chr >> 4]+hex[chr & 0xf];
            else
                ret += str[i];
        }
        return ret;
    }
    return Escaper;
});
