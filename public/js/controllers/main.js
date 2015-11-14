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

    // private variables
    var videoTimer;

    // private methods
    function getUserIndex (user) {
      return c.users.indexOf(user);
    }

    function getVideoIndex (video) {
      return c.playlist.map(function (e) { return e.id.videoId; }).indexOf(video.id.videoId);
    }

    // room is full
    socket.on('roomFull', function () {
      alert('Sorry, but the room is full. Please try again later.');
    });

    // populate initial data when first connecting
    socket.on('populateInitialData', function (data) {
      c.messages = data.messages;
      c.playedVideos = data.playedVideos;
      c.playlist = data.playlist;
      c.users = data.users;
    });

    // create a username
    c.createUser = function () {
      c.showUserOverlay = true;
    };

    c.saveUser = function () {
      if (!c.username) {
        alert('Please enter a valid username.');
        return;
      }

      socket.emit('usernameRequested', c.username);
    };

    socket.on('usernameError', function () {
      alert('Sorry, that username is taken.');
    });

    socket.on('usernameSuccess', function () {
      c.showUserOverlay = false;
      socket.emit('getCurrentVideo');
    });

    socket.on('updateCurrentVideo', function (data) {
      c.current = data;

      // account for lag
      c.current.startSeconds = c.current.startSeconds + 3;

      if (c.current.video) {
        c.load();
      }
    });

    // message added to chat
    c.send = function () {
      if (!c.message) {
        alert('Please enter a valid message.');
        return;
      }

      socket.emit('messageSent', { username: c.username, message: c.message });
      c.message = '';
    };

    socket.on('addMessage', function (message) {
      c.messages.push(message);

      $timeout(function () {
        var $list = $('.message-list');
        $list.scrollTop($list[0].scrollHeight);
      }, 0, false);
    });

    // video added to queue
    c.add = function (index, video) {
      c.results.splice(index, 1);

      socket.emit('videoAddedToQueue', video);
    };

    socket.on('addVideoToQueue', function (video) {
      c.playlist.push(video);

      // if it's the first video, play!
      if (c.playlist.length === 1) {
        c.current.video = c.playlist[0];
        c.load();
      }
    });

    // video deleted from queue
    c.delete = function (video) {
      socket.emit('videoRemovedFromQueue', video);
    };

    socket.on('removeVideoFromQueue', function (video) {
      var index = getVideoIndex(video);

      c.playlist.splice(index, 1);
    });

    // user connected
    socket.on('addUser', function (user) {
      c.users.push(user);
    });

    // user disconnected
    socket.on('removeUser', function (user) {
      var index = getUserIndex(user);

      c.users.splice(index, 1);
    });

    // video ended
    c.playNextVideo = function (video) {
      var index = getVideoIndex(video);
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

    socket.on('playNextVideo', function (video) {
      c.playNextVideo(video);
    });

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

    c.load = function () {
      VideoService.launchPlayer(c.current);
    };

    c.showHistory = function () {
      c.toggleQueue = false;
    };

    c.showQueue = function () {
      c.toggleQueue = true;
    };

    if (!c.username) {
      c.createUser();
    }
  }

  angular.module('ecreaylist')
    .controller('MainCtrl', MainCtrl);
})();
