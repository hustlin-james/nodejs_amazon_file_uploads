/**
 * Module dependencies.
 */
var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , fs = require('fs')
  , bcrypt = require('bcrypt')
  , path = require('path')
  , formidable=require('formidable')
  , usersFile='./db/users.txt'
  , uploadDir='./uploads'
  , downloadsDir='./downloads';
var app = express();

var s3 = require('./AWSWrapper').s3('./config/config.json','./config/mainstorage.txt');

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));

var cookiesecret = fs.readFileSync('./config/cookiesecret.txt');

if(cookiesecret === "")
	throw new Error("Cookie Secret Empty!");

app.use(express.cookieParser(cookiesecret.toString()));
//app.use(express.bodyParser());
app.use(express.methodOverride());

//custom middleware
app.use(sessionTest);

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

//may need to move these to there own files later...
//Eventually may move the login stuff to an https server
function sessionTest(req,res,next){

	if(req.method === 'GET' &&
			(req.url === '/' || req.url === '/login' 
				|| req.url.substring(0,6) === '/files')
				|| req.url.substring(0, '/filedownload'.length) === '/filedownload')
	{
		var signedCookies = req.signedCookies;
		var numValues = Object.keys(signedCookies).length;
		console.log("sessionTest, signedCookies: "+JSON.stringify(signedCookies));
		if(numValues === 0 || signedCookies.user === undefined){
			//redirect user to the login page
			res.render('login', {msg:"Please login"});
		}else{
			next();
		}
	}else{
		next();
	}
	
}

//sessions test for the rest api, shouldn't respond with 
//pages
function sessionTestRest(req,res,callback){
	if(req.method==='GET'){
		var signedCookies = req.signedCookies;
		var numValues=Object.keys(signedCookies).length;
		if(numValues===0||signedCookies.user===undefined){
			res.json({error:'you must be logined in to continue.'});
		}else{
			req.username=signedCookies.user;
			callback();
		}
	}
}

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', function(req,res){
	var username = req.signedCookies.user;
	res.render('index', {user:username});
});

app.post('/login', function(req,res){
	var username='';
	var password='';
	
	var form = new formidable.IncomingForm();
	
	form.on('field', function(name,value){
		if(name==='username')
			username=value;
		else
			password=value;
	});
	
	form.on('end', function(){
		fs.readFile(usersFile, function(err, contents){
			if(err){
				console.log("unable to read db file");
				res.send("unable to login");
			}else{
				console.log("contents: "+contents);
				var user = JSON.parse(contents);
				console.log(user);
				bcrypt.compare(password, user.password, function(err, result){
					if(err){
						console.log("bcrypt messed up.");
						res.send("unable to login");
					}else{
						if(result === true && username === user.username){
							//passwords match
							console.log("passwords and username matched!");
							//set cookie and redirect to the index page
							res.cookie('user',username, {signed: true});
							var html='<a href="/">Click for your files.</a>';
							res.send(html);
						}
						else{
							res.send("sorry invalid credentials");
						}
					}
				});
			}
		});
	});
	form.parse(req);
});

app.get('/logout', function(req,res){
	var user = req.signedCookies.user;
	res.clearCookie('user');
	res.redirect('/');
});

//Top most level for the user
app.get('/userstoragespace', function(req,res){
	//if returns empty array then user has no created a folder
	sessionTestRest(req,res,function(){
		s3.list_all_user_folders(req.username, function(err,data){
			if(err){
				res.json({error:"coulnd't retrieve folders"});
			}else{
				res.json(data);
			}
		});
	});
});

//files API
app.get('/files/*', function(req,res){
	var path = req.path;
	path = path.substring(7, path.length);
	console.log('path: '+path);
	
	var user = req.signedCookies.user;
	s3.list_folders_for_user_filepath(path,function(err,data){
		if(err){
			res.render('files', {'error':"error: couldn't retrieve files."});
		}else{
			res.render('files', {'user':user,'currentDir':path,'files':data});
		}
	});
});	

app.get('/filedownload/*', function(req,res){
	var path = req.path;
	path = path.substring(14, path.length);
	console.log('path: '+path);
	
	var index = path.split('/').length - 1;
	var fileName = path.split('/')[index];
	
	s3.download_file_for_user(path, function(err,data){
		if(err){
			res.send('couldnt dowload file');
		}else{
			fs.writeFile(downloadsDir+'/'+fileName, data.Body, function(err){
				if(err){
					res.send('couldnt download file');
				}else{
					//send the file to the browser
                    res.set('Content-disposition', 'attachment; filename='+fileName);
                    res.set('Content-Type', data.ContentType);
                    res.sendfile(downloadsDir+'/'+fileName, function(err){
                        console.log('file has finished sending');
                        fs.unlink(downloadsDir+'/'+fileName, function(err){
                            if(err){
                                console.log('coulnd unlink file: '+fileName);
                            }
                            else{
                                console.log('file deleted: '+fileName);
                            }
                        });
                    });
				}
			});
		}
	});
	//res.send('end');
});

app.post('/fileupload', function(req,res){
	//upload to this directory on amazon
	var form = new formidable.IncomingForm();
	form.uploadDir= uploadDir;
	form.keepExtensions=true;
	form.multiples=true;
	
	var files = [];
	var dirField='';
	
	form.on('field', function(name, value){
		dirField=value;
	});
	
	form.on('file', function(name,file){
		files.push({fileName:file.name, filePath:file.path})
	});

	form.on('end', function(){
		
		for(var f in files){
			var uploadFile=files[f];
			var fileName = uploadFile.fileName;
			var filePath = uploadFile.filePath;
			var fileStream = fs.createReadStream(filePath);
			
			s3.upload_file_for_user_to_folder(dirField,
					uploadFile.fileName,fileStream,function(e,d){
				if(e)
					console.log("error");
				else{
					//delete the file in the upload folder
					fs.unlink(filePath, function(e){
						if(e){
							console.log("unable to unlink: "+filePath);
						}
					});
					console.log('file uploaded: '+fileName);
				}
			});
		}
		res.redirect('files/'+dirField);
	});
	form.parse(req);
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
