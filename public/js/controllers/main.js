(function () {
  'use strict';

  function MainCtrl ($timeout, socket, VideoService) {
    var c = this; // cache controller

    c.current = {
      startSeconds: 0,
      video: null
    };

    c.messages = [];
    c.playedVideos = [];
    c.playerIsMuted = false;
    c.playlist = [];
    c.query = '';
    c.lastQuery = '';
    c.results = [];
    c.showSearchResults = false;
    c.showUserOverlay = false;
    c.theme = null;
    c.toggleQueue = true;
    c.username = '';
    c.users = [];
    c.userVote = null;
    c.videoEnded = false;

    var isAdmin = false;

    /**
     * Run before createNotification()
     * in order to be able to use WebNotifications
     */
    function requestNotificationPermission() {

      // essentially checks for IE/Edge
      if (window.hasOwnProperty('Notification')) {
        Notification.requestPermission();
      }
    }

    /**
    * Gets the youtube object from VideoService
    */
    function init () {
      c.youtube = VideoService.getYoutube();
      requestNotificationPermission(); // check for notification functionality
    }
    init();

    /**
     * Creates a browser notification alert
     * @param title {String} heading of notification
     * @param body {String} content of notification
     */
    function createNotification(title, body) {

      // unnecessary evil
      if (window.hasOwnProperty('Notification')) {
        var notification = new Notification(title, {
          body: body,
          icon: 'tbd.gif' // TODO: add logo or avatar path here
        });

        // show notification for a max of 3s
        setTimeout(notification.close.bind(notification), 3000);
      }
    }

    /**
    * Figures out what to do with a new message
    */
    function determineMessageEmit () {
      var adminCheck = '/admin=';
      var deleteCheck = '/delete=';
      var kickCheck = '/kick=';
      var skipCheck = '/skipcurrent';
      var themeCheck = '/theme=';

      // user is registering as an admin
      if (c.message.indexOf(adminCheck) > -1) {
        socket.emit('adminStatusRequested', c.message.split(adminCheck)[1]);
        return;
      }

      // user is changing theme
      if (c.message.indexOf(themeCheck) > -1) {
        socket.emit('themeUpdated', c.message.split(themeCheck)[1]);
        return;
      }

      // admin-only commands
      if (isAdmin) {

        // user is deleting video
        if (c.message.indexOf(deleteCheck) > -1) {
          var video = c.playlist[c.message.split(deleteCheck)[1]];

          if (video && c.current.video.id.videoId !== video.id.videoId) {
            socket.emit('videoRemovedFromQueue', video);
          }

          return;
        }

        // user is kicking out another user
        if (c.message.indexOf(kickCheck) > -1) {
          socket.emit('userKicked', c.message.split(kickCheck)[1]);
        }

        // user is skipping current video
        if (c.message === skipCheck) {

          // make sure there is a next video
          if (c.playlist.length > 1) {
            socket.emit('videoSkipped', c.current.video);
          }

          return;
        }
      }

      socket.emit('messageSent', { username: c.username, message: c.message });
    }

    /**
    * Returns the array index of a submitted username in c.users
    * @param user {String} username to check for
    * @returns {Integer} index of submitted username
    */
    function getUserIndex (user) {
      return c.users.indexOf(user);
    }

    /**
    * Returns the array index of a submitted video in c.playlist
    * @param video {Object} video to check for
    * @param arr {Array} array to check in (defaults to c.playlist if undefined)
    * @returns {Integer} index of submitted video
    */
    function getVideoIndex (video, arr) {
      var arrayToCheck = arr || c.playlist;

      return arrayToCheck.map(function (e) { return e.id.videoId; }).indexOf(video.id.videoId);
    }

    /**
    * Updates submitted element's height and max-height
    * @param $element {DOM item} element to be updated
    * @param height {Integer} offset to be added
    */
    function setElementSize ($element, height) {
      var update = ($element.outerHeight() + height) + 'px';

      $element.css({ 'height': update, 'max-height': update });
    }

    /*
    * Calculates the column sizes so they're always even
    */
    function resizeColumns () {
      $timeout(function () {
        var lHeight = $('.messages-column').outerHeight();
        var rHeight = $('.video-column').outerHeight();
        var offset = rHeight - lHeight;

        if (!c.showSearchResults) {
          setElementSize($('.message-list'), offset);
        } else {
          setElementSize($('.search-results-inner'), offset);
        }
      }, 0, false); // surround in a $timeout just to make sure DOM ready
    }

    /**
    * Scrolls to bottom of message list
    */
    function scrollMessageList () {
      $timeout(function () {
        var $list = $('.message-list');
        $list.scrollTop($list[0].scrollHeight);
      }, 0, false);
    }

    /**
    * Request from server to get status (keeps connection open)
    */
    socket.on('getStatus', function () {
      socket.emit('updateStatus');
    });

    /**
    * Too many users
    */
    socket.on('roomFull', function () {
      alert('Sorry, but the room is full. Please try again later.');
    });

    /**
    * Populates initial data for a new user (if at least 1 other connection)
    * @param data {Object} existing data to cache
    */
    socket.on('populateInitialData', function (data) {
      if (data.messages) c.messages = data.messages;
      if (data.playedVideos) c.playedVideos = data.playedVideos;
      if (data.playlist) c.playlist = data.playlist;
      if (data.theme) c.theme = data.theme;
      if (data.users) c.users = data.users;
    });

    /**
    * Shows registration overlay
    */
    c.createUser = function () {
      var username = localStorage.getItem('sfm-username');

      c.showUserOverlay = true;

      // if username has been saved, pre-fill
      if (username) {
        c.username = username;
      }

      // focus input field
      $timeout(function () {
        $('.overlay-inner input').focus();
      }, 0, false);
    };

    /**
    * Submits username to server
    */
    c.saveUser = function () {

      // if no username, exit
      if (!c.username) {
        alert('Please enter a valid username.');
        return;
      }

      socket.emit('usernameRequested', c.username);
    };

    /**
    * Username is taken
    */
    socket.on('usernameError', function () {
      alert('Sorry, that username is taken.');
    });

    /**
    * Username has been registered
    */
    socket.on('usernameSuccess', function () {
      c.showUserOverlay = false;
      localStorage.setItem('sfm-username', c.username);
      socket.emit('getCurrentVideo');
    });

    /**
    * User has been been registered as admin
    */
    socket.on('updateAdminStatus', function () {
      isAdmin = true;
    });

    /**
    * Replaces c.current with currentVideo from server
    * @param data {Object} currently playing video
    */
    socket.on('updateCurrentVideo', function (data) {
      c.current = data;
      c.userVote = null;

      // account for lag
      c.current.startSeconds = c.current.startSeconds + 3;

      // if video not null, load
      if (c.current.video) {
        c.load();
      }

      // resize columns
      resizeColumns();
    });

    /**
    * Submits message to server
    */
    c.send = function () {

      // if no message, exit
      if (!c.message) {
        alert('Please enter a valid message.');
        return;
      }

      determineMessageEmit();
      c.message = '';
    };

    /**
    * Updates room theme
    * @param theme {Object} new theme
    */
    socket.on('updateTheme', function (theme) {
      c.theme = theme;
      resizeColumns();
    });

    /**
    * Adds new message to c.messages
    * @param message {Object} message to be added
    */
    socket.on('addMessage', function (message) {
      c.messages.push(message);

      // don't notify originator of new message
      if (c.username !== message.username) {
        createNotification(message.username, message.message);
      }

      // scroll to bottom of message list
      scrollMessageList();
    });

    /**
    * Submits video to server
    * @param index {Integer} index of video in search results
    * @param video {Object} video to be added
    */
    c.add = function (index, video) {
      var added = getVideoIndex(video);

      // if video in queue, exit
      if (added > -1) {
        alert('The selected video is already in the queue.');
        return;
      }

      // add username
      video.username = c.username;

      // remove from search results
      c.results.splice(index, 1);

      socket.emit('videoAddedToQueue', video);
    };

    /**
    * Adds video to queue
    * @param video {Object} video to be added
    */
    socket.on('addVideoToQueue', function (video) {
      c.playlist.push(video);

      // if it's the first video, play!
      if (c.playlist.length === 1) {
        c.current.video = c.playlist[0];
        c.userVote = null;
        c.load();
      }

      // resize columns
      resizeColumns();
    });

    /**
    * Submits video to server to be removed
    * @param video {Object} video to be removed
    */
    c.delete = function (video) {
      socket.emit('videoRemovedFromQueue', video);
    };

    /**
    * Removes video from queue
    * @param video {Object} video to be removed
    */
    socket.on('removeVideoFromQueue', function (video) {
      var index = getVideoIndex(video);

      c.playlist.splice(index, 1);
    });

    /**
    * New user has registered
    * @param user {String} new user's username
    */
    socket.on('addUser', function (user) {
      c.users.push(user);
      resizeColumns();
    });

    /**
    * User has disconnected
    * @param user {String} disconnected user's username
    */
    socket.on('removeUser', function (user) {
      var index = getUserIndex(user);

      c.users.splice(index, 1);
      resizeColumns();
    });

    c.toggleMute = function () {
      if (c.playerIsMuted) {
        c.playerIsMuted = false;
        c.youtube.player.unMute();
        return;
      }

      c.playerIsMuted = true;
      c.youtube.player.mute();
    };

    /**
    * Upvotes the currently playing video
    */
    c.upvote = function () {

      // if already voted, exit
      if (c.userVote) {
        return;
      }

      c.userVote = 'upvote';
      socket.emit('upvote', c.current.video);
    };

    /**
    * Downvotes the currently playing video
    */
    c.downvote = function () {

      // if already voted, exit
      if (c.userVote) {
        return;
      }

      c.userVote = 'downvote';
      socket.emit('downvote', c.current.video);
    };

    /**
    * Plays the next video in the queue
    * @param video {Object} recently ended video
    */
    c.playNextVideo = function (video) {
      var index = getVideoIndex(video);
      var nextVideo = c.playlist[index + 1];

      // update playlists
      c.playedVideos.push(video);
      c.playlist.splice(index, 1);
      c.videoEnded = false;

      // if no videos left in queue, exit
      if (!nextVideo) {
        return;
      }

      c.current.video = nextVideo;
      c.current.startSeconds = 0;
      c.userVote = null;
      c.load();
    };

    /**
    * Video has ended, show loading spinner
    */
    socket.on('updateVideoEnded', function () {
      c.videoEnded = true;
    });

    /**
    * It's time to play the next video
    * @param video {Object} recently ended video
    */
    socket.on('playNextVideo', function (video) {
      c.playNextVideo(video);
    });

    /**
    * Sends request to YouTube API
    */
    c.search = function () {
      VideoService.search(c.query)
        .then(function (res) {
          c.lastQuery = c.query;
          c.results = res.data.items;
          c.showSearchResults = true;
          resizeColumns();
        }, function (err) {
          console.log(err);
        });
    };

    /**
    * Clears current search
    */
    c.clearSearch = function () {
      c.query = '';
      c.lastQuery = '';
      c.results = [];
      c.showSearchResults = false;
      resizeColumns();
      scrollMessageList();
    };

    /**
    * Loads current video (c.current)
    */
    c.load = function () {
      VideoService.launchPlayer(c.current);
    };

    /**
    * Shows history tab
    */
    c.showHistory = function () {
      c.toggleQueue = false;
    };

    /**
    * Shows queue tab
    */
    c.showQueue = function () {
      c.toggleQueue = true;
    };

    // if the user has not registered, make them!
    if (!c.username) {
      c.createUser();
    }
  }

  angular.module('ecreaylist')
    .controller('MainCtrl', MainCtrl);
})();
