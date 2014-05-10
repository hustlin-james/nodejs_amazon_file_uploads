var AWS=require('aws-sdk'),
fs=require('fs'),
mainStorageArea="",
s3=null;

var AWSWrapper = function(apiKeysPath,mainStorageAreaPath){
    if(apiKeysPath !== "" && mainStorageAreaPath !== ""){
        //load the api keys
        AWS.config.loadFromPath(apiKeysPath);
        //find where in (bucket) s3 where going to store things
        mainStorageArea = fs.readFileSync(mainStorageAreaPath).toString();
        
        if(mainStorageArea === "")
        	throw new Error("mainStorageArea is empty");
        
        s3 = new AWS.S3();

    }else{
        throw new Error("apiKeysPath and mainStorageAreaPath are required");
    }
};

//the username is included in the folderPath
AWSWrapper.prototype.download_file_for_user = function(folderPath, callback){
	var params = {
			Bucket: mainStorageArea,
			Key: folderPath
	};
	s3.getObject(params, function(err,data){
		if(err){
			if(typeof callback === 'function')
				callback(err,null);
		}else{
			if(typeof callback === 'function')
				callback(null, data);
		}
	});
};

AWSWrapper.prototype.upload_file_for_user_to_folder = 
    function(folderPath,fileName,fileStream,callback){

	console.log('AWSWrapper folderPath: '+folderPath);
	console.log('AWSWrapper fileName: '+fileName);
	
    if(folderPath === "" || folderPath === null || folderPath === undefined ){
        if(typeof callback === "function")
            callback("folderPath is not valid",null);
    }

    var params={
        Bucket:mainStorageArea,
        Key:folderPath+fileName,
        Body: fileStream
    };

    s3.putObject(params, function(e,d){
        if(typeof callback === "function")
            callback(e,d);
    });
}

AWSWrapper.prototype.create_folder_for_user = function(username, folderPath, callback){
    if(username === "" || username === null || username === undefined 
        || folderPath === "" || folderPath === null || folderPath === undefined){

        // new Error("username or folderPath is not valid");
        if(typeof callback === "function")
            callback("username or folderPath is not valid", null);
    }

    if(folderPath[folderPath.length - 1] === '/')
        folderPath=folderPath.substring(0, folderPath.length-1);

    var params={
        Bucket:mainStorageArea,
        Key:username+'/'+folderPath+'/'
    };

     s3.putObject(params, function(e,d){
        if(typeof callback === "function")
            callback(e,d);
    });
}

AWSWrapper.prototype.create_user_folder = function(username,callback){
    if(username === "" || username === null || username===undefined){
        //console.log("need username for create_user_folder");
        if (typeof callback === "function")
            callback("need username for create_user_folder", null);
    }

    var params = 
    {
        Bucket:mainStorageArea,
        Key:username+'/'
        /* May needs this later...
        Metadata: {
            filetype:'folder'
        }
        */
    };

    s3.putObject(params, function(e,d){
        if (typeof callback === "function")
            callback(e,d);
    });
}

AWSWrapper.prototype.list_folders_for_user_filepath = 
	function(filepath, callback){
	
	//username should be include in the filepath as the first path
	var params = {
			Bucket:mainStorageArea,
			Prefix:filepath
	};
	s3.listObjects(params, function(err,data){
	    if(err){
	        console.log(err);
	        if(typeof callback === 'function')
	        	callback("couldnt list folders",null);
	    }else{
	        var i = 0;
	        var contents = data.Contents;
	        var files = [];
	        for(;i<contents.length;i++){
	            var key = contents[i].Key;
	            //console.log('key: '+key);
	            files.push(key);
	        } 
	        
	        if(typeof callback === 'function'){
	        	callback(null,getFilesSubDirOneLevel(filepath,files));
	        }
	    }
	});
	
}

//list all the files from the start of the bucket
AWSWrapper.prototype.list_all_user_folders = function(username,callback){
	var params = {
			Bucket:mainStorageArea,
			Prefix: username
	};
    s3.listObjects(params, function(err,data){
        if(err){
            //console.log(err);
            if(typeof callback === "function")
                callback(err,data);

        }else{
            var i = 0;
            var contents = data.Contents;
            var folders = [];          
            for(;i<contents.length;i++){
                var key = contents[i].Key;
                if(checkIfObjectIsFolder(key)){
                    folders.push(key);
                }   
            } 
            if(typeof callback === "function")
                callback(err,folders);
        }
    });
};

//Util functions
function getFilesSubDirOneLevel(prefix,files){
    //just some preprocessing
    if(prefix[0] === '/')
        prefix = prefix.substr(1, prefix.length);

    if(prefix[prefix.length - 1] !== '/')
        prefix = prefix +'/';

    var filesObjectsAry = [];
    for(var f in files){
        var result = files[f].split(prefix);

        if(result.length > 1){
            if(result[1] === ''){
                filesObjectsAry.push({
                    'name':'.', 
                    //'path':result[0], 
                    'path':'',
                    'type':'dir'
                });
            }else{
                var index = result[1].indexOf('/');
                if( index > -1){
                    var t = result[1].substr(0, index);
                    filesObjectsAry.push({
                        'name':t+'/', 
                        //'path':prefix+t+'/', 
                        'path':t+'/', 
                        'type':'dir'
                    });
                }else{
                    filesObjectsAry.push({
                        'name':result[1], 
                        //'path':prefix+result[1], 
                        'path':result[1], 
                        'type':'file'
                    });
                }
            }
        }
    }
    return filesObjectsAry;
}

function checkIfObjectIsFolder(key){
    if(key[key.length-1] === '/' &&
     key[key.length - 2] !== '/')
        return true;
    return false;
}

exports.s3=function(apiKeysPath,mainStorageAreaPath){
    return new AWSWrapper(apiKeysPath,mainStorageAreaPath);
};