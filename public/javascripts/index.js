$(function(){
	console.log('starting index.js');
	
	$.get("/userstoragespace")
	.done(function(data){
		//find the one that only has one world and a path
		//i.e. something/
		//if successfuly it will return a string array 
		//else an object with error property
		
		if(data.error){
			//TODO: do something here
		}else{
			var foldersDiv = $('#foldersDiv');
			if(data.length === 0){
				var p = $('<p>').text('You have no folders.');
				foldersDiv.html(p);
			}
			else{
				//find the folder with only one slash
				var foldersArray = data;
				var mainFolder = "";
				for(var f in foldersArray){
					if(foldersArray[f].indexOf('/') === 
						foldersArray[f].length -1){
						mainFolder = foldersArray[f];
					}
				}			
				
				var p = $('<p>').html('main folder: <a href="/files/'+mainFolder+'">'
						+mainFolder+'</a>');
				foldersDiv.html(p);
			}
		}
		
	 }).fail(function(){
		 console.log("unable to load user folder");
	 });
});
