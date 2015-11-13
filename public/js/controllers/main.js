(function () {
  'use strict';

  function MainCtrl ($timeout, socket, VideoService) {
    var c = this;

    function init () {
      c.youtube = VideoService.getYoutube();
    }
    init();

    // scoped variables
    c.current = {
      startSeconds: 0,
      video: null
    };

    c.messages = [];
    c.playedVideos = [];
    c.playlist = [];
    c.query = '';
    c.results = [];
    c.showSearchResults = false;
    c.showUserOverlay = false;
    c.toggleQueue = true;
    c.username = '';
    c.users = [];

    var videoTimer;

    // socket events
    socket.on('roomFull', function () {
      alert('Sorry, but the room is full. Please try again later.');
    });

    socket.on('refreshMessages', function (messages) {
      c.messages = messages;

      $timeout(function () {
        var $list = $('.message-list');
        $list.scrollTop($list[0].scrollHeight);
      }, 0, false);
    });

    socket.on('refreshPlaylists', function (data) {
      c.playedVideos = data.playedVideos;
      c.playlist = data.playlist;

      if (c.playlist.length === 1) {
        c.current.video = c.playlist[0];
        c.load();
      }
    });

    socket.on('refreshUsers', function (users) {
      c.users = users;
    });

    socket.on('playCurrentVideo', function (video) {
      video.startSeconds = video.startSeconds + 5; // account for lag

      c.current = video;
      c.load();
    });

    socket.on('playNextVideo', function () {
      c.playNextVideo();
    });

    socket.on('usernameError', function () {
      alert('Unfortunately, that username is already taken.');
    });

    socket.on('usernameSuccess', function () {
      c.showUserOverlay = false;
    });

    // controller functions
    c.createUser = function () {
      c.showUserOverlay = true;
    };

    c.saveUser = function () {
      if (!c.username) {
        alert('Please enter a valid username.');
        return;
      }

      socket.emit('usernameRequest', c.username);
    };

    c.search = function () {
      VideoService.search(c.query)
        .then(function (res) {
          c.results = res.data.items;
          c.showSearchResults = true;
        }, function (err) {
          console.log(err);
        });
    };

    c.clearSearch = function () {
      c.query = '';
      c.results = [];
      c.showSearchResults = false;
    };

    c.add = function (index, video) {
      c.playlist.push(video);
      c.results.splice(index, 1);

      socket.emit('playlistAdd', video);
    };

    c.load = function () {
      if (videoTimer) {
        clearInterval(videoTimer);
      }

      VideoService.launchPlayer(c.current);
    };

    c.playNextVideo = function () {
      if (!c.current.video) {
        return;
      }

      var index = c.playlist.map(function (e) { return e.id.videoId; }).indexOf(c.current.video.id.videoId);
      var nextVideo = c.playlist[index + 1];

      // update playlists
      c.playedVideos.push(c.playlist[index]);
      c.playlist.splice(index, 1);

      if (!nextVideo) {
        return;
      }

      c.current.video = nextVideo;
      c.current.startSeconds = 0;

      c.load();
    };

    c.delete = function (index) {
      c.playlist.splice(index, 1);

      socket.emit('playlistDelete', index);
    };

    c.send = function () {
      if (!c.message) {
        alert('Please enter a valid message.');
        return;
      }

      socket.emit('messageSent', { username: c.username, message: c.message });
      c.message = '';
    };

    c.showQueue = function () {
      c.toggleQueue = true;
    };

    c.showHistory = function () {
      c.toggleQueue = false;
    };

    if (!c.username) {
      c.createUser();
    }
  }

  angular.module('ecreaylist')
    .controller('MainCtrl', MainCtrl);
})();
