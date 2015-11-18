(function () {
  'use strict';

  function VideoService ($http, $rootScope, $timeout, $window, socket) {
    var s = this;

    var youtube = {
      player: null, // keeps track of the player object
      ready: false,
      startSeconds: 0,
      video: null // keeps track of the current video
    };

    var paused = false;
    var videoTimeout = null;
    var videoTimer = null;

    function onPlayerStateChange (event) {
      if (event.data === YT.PlayerState.UNSTARTED) {

        if (videoTimeout) {
          return;
        }

        // if video still not playing after 10 seconds, skip
        videoTimeout = $timeout(function () {
          if (event.data === YT.PlayerState.UNSTARTED) {
            videoTimeout = null;
            socket.emit('videoEnded', youtube.video);
          }
        }, 10000);
      }

      if (event.data === YT.PlayerState.PLAYING) {
        if (paused) {
          paused = false;
          socket.emit('videoUnpaused');
          return;
        }

        videoTimer = setInterval(function () {
          socket.emit('currentVideoUpdated', { video: youtube.video, startSeconds: youtube.player.getCurrentTime() });
        }, 1000);
      }

      if (event.data === YT.PlayerState.PAUSED) {
        clearInterval(videoTimer);
        paused = true;
      }

      if (event.data === YT.PlayerState.ENDED) {
        clearInterval(videoTimer);
        socket.emit('videoEnded', youtube.video);
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

    /**
    * Loads the submitted video
    * @param data {Object} video and start time information
    * @returns youtube {Object} youtube object
    */
    s.launchPlayer = function (data) {
      youtube.player.loadVideoById({ videoId: data.video.id.videoId, startSeconds: data.startSeconds });

      // update stored data
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

    /**
    * Searches YouTube for query results
    * @param query {String} query to search for
    * @returns request {Promise}
    */
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

    $window.onYouTubeIframeAPIReady = function () {
      youtube.ready = true;
      s.loadPlayer();
      $rootScope.$apply();
    };
  }

  angular.module('ecreaylist')
    .service('VideoService', VideoService);
})();
