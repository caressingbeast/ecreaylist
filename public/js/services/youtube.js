(function () {
  'use strict';

  function VideoService ($http) {
    var s = this;

    s.search = function (query) {
      return $http.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: 'AIzaSyBGHs_0KIIfF7ho_HYach8KYkNKQKOPvos',
          type: 'video',
          maxResults: '20',
          part: 'id,snippet',
          fields: 'items/id,items/snippet/title,items/snippet/description,items/snippet/thumbnails/default,items/snippet/channelTitle,nextPageToken',
          q: query
        }
      });
    };
  }

  angular.module('ecreaylist')
    .service('VideoService', VideoService);
})();
