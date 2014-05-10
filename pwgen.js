/**
 * New node file
 */


var bcrypt=require('bcrypt');
var pw = process.argv[2];

console.log("pw: "+pw);
bcrypt.genSalt(10, function(err,salt){
	bcrypt.hash(pw,salt,function(err,hash){
		console.log("hash: "+hash);
	});
});