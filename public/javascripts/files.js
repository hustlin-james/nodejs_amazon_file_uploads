$(function(){
	$('#filesDiv.a').click(function(e){
		var hrefValue=$(this).attr('href');
		if(hrefValue === '' || hrefValue[hrefValue.length - 1] === '/'){
			
		}else{
			console.log('hrefValue: '+hrefValue);
			var newHrefValue = $('#currentDir').val()+hrefValue;
			newHrefValue = '/filedownload/'+newHrefValue;
			console.log('newHrefValue: '+newHrefValue);
			$(this).attr('href', newHrefValue);
			//e.preventDefault();
		}
	});
});