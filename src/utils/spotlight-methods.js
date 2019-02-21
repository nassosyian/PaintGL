'use strict'

// function toDataURL(src, callback, outputFormat) 
// {
// 	var img = new Image();
// 	img.crossOrigin = 'Anonymous';
// 	img.onload = function() 
// 	{
// 		var canvas = document.createElement('CANVAS');
// 		var ctx = canvas.getContext('2d');
// 		var dataURL;
// 		canvas.height = this.naturalHeight;
// 		canvas.width = this.naturalWidth;
// 		ctx.drawImage(this, 0, 0);
// 		dataURL = canvas.toDataURL(outputFormat);
// 		callback(dataURL);
// 	};
// 	img.src = src;
// 	if (img.complete || typeof img.complete === 'undefined') 
// 	{
// 		img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
// 		img.src = src;
// 	}
// }

export default {
	readSpotlightImage(fileObj)
	{
		return new Promise( (resolve, reject)=> 
		{
			if (!fileObj)
			{
				reject();
				return;
			}
			const file = fileObj;//fileList[0];
			var reader = new FileReader();

			reader.onerror = (e) =>
			{
				log(e.error);
				reject(e.error);
				// this.processingMeshFile = false;
			};

			reader.onload = (e) =>
			{
				log('image file');
				// log(e.target.result);
				this.spotlightImgSrc = (e.target.result);
				var img = new Image();
				img.onload = function () {
					resolve({img: img, src: e.target.result});
				};
				
				img.src = e.target.result;
			};
			reader.readAsDataURL(file);
		} )
		
	},
	bindSpotlightEvents()
	{
		window._vm_.$on('droppedSpotlight', (payload)=>
		{ 
			this.readSpotlightImage(payload)
				.then(({img, src})=>
				{
					var width = img.naturalWidth;
					var height = img.naturalHeight;
					log(`natural ${width} ${height}`);
					this.setSpotlightImg( img );
					this.setSpotlightImgSrc( src );
				})
				.catch()
		});
	}
};