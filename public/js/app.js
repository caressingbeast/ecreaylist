function loadApi() {
	var tag = document.createElement('script');
	tag.src = "//www.youtube.com/iframe_api";
	var firstScriptTag = document.getElementsByTagName('script')[0];
	firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

angular.module('ecreaylist', [])
	.run(loadApi);

require('./controllers/main');
require('./services/socket');
require('./services/youtube');
