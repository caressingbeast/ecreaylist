(function () {
  'use strict';

  angular.module('ecreaylist', []);

  angular.module('ecreaylist').run(function () {
    var tag = document.createElement('script');
    tag.src = "//www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  });
})();
