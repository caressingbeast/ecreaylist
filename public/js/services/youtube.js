(function () {
  'use strict';

  function VideoService ($http, $rootScope, $window, socket) {
    var s = this;

    var youtube = {
      player: null,
      ready: false,
      startSeconds: 0,
      video: null
    };

    var videoTimer;

    function onPlayerStateChange (event) {
      if (event.data === YT.PlayerState.PLAYING) {
        videoTimer = setInterval(function () {
          socket.emit('currentVideoUpdated', { video: youtube.video, startSeconds: youtube.player.getCurrentTime() });
        }, 500);
      }

      if (event.data === YT.PlayerState.ENDED) {
        clearInterval(videoTimer);
        socket.emit('videoEnded');
      }
    }

    s.createPlayer = function () {
      return new YT.Player('player', {
        width: '100%',
        playerVars: {
          controls: 0,
          rel: 0,
          showInfo: 0
        },
        events: {
          'onStateChange': onPlayerStateChange
        }
      });
    };

    s.getYoutube = function () {
      return youtube;
    };

    s.launchPlayer = function (data) {
      youtube.player.loadVideoById({ videoId: data.video.id.videoId, startSeconds: data.startSeconds });

      youtube.startSeconds = data.startSeconds;
      youtube.video = data.video;

      return youtube;
    };

    s.loadPlayer = function () {
      if (youtube.ready) {
        if (youtube.player) {
          youtube.player.destroy();
        }

        youtube.player = s.createPlayer();
      }
    };

    s.search = function (query) {
      return $http.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: 'AIzaSyBGHs_0KIIfF7ho_HYach8KYkNKQKOPvos',
          type: 'video',
          maxResults: '10',
          part: 'id,snippet',
          fields: 'items/id,items/snippet/title,items/snippet/description,items/snippet/thumbnails/default,items/snippet/channelTitle,nextPageToken',
          q: query
        }
      });
    };

    $window.onYouTubeIframeAPIReady = function () {
      youtube.ready = true;
      s.loadPlayer();
      $rootScope.$apply();
    };
  }

  angular.module('ecreaylist')
    .service('VideoService', VideoService);
})();
