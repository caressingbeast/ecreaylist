// app/sockets.js

module.exports = function (io) {
  var currentTheme = null; // keeps track of room theme
  var currentVideo = { video: null, startSeconds: 0 }; // keeps track of currently playing video
  var karma = {}; // keeps track of user upvotes/downvotes
  var messages = []; // keeps track of chat messages
  var playedVideos = []; // keeps track of video history
  var playlist = []; // keeps track of video queue
  var userArray = []; // keeps track of toLowerCase() usernames (for uniqueness checks)
  var userList = []; // keeps track of submitted usernames
  var votes = { upvotes: 0, downvotes: 0 }; // tracks upvotes/downvotes

  /**
  * Clears existing data
  */
  function clearExistingData () {
    currentTheme = null;
    currentVideo = { video: null, startSeconds: 0 };
    karma = {};
    messages = [];
    playedVideos = [];
    playlist = [];
    userArray = [];
    userList = [];
    votes = { upvotes: 0, downvotes: 0 };
  }

  /**
  * Returns the array index of a submitted username in userArray/userList
  * @param name {String} username to check for
  * @param arr {Array} array to search in (defaults to userArray if undefined)
  * @returns {Integer} index of submitted username
  */
  function getUsernameIndex (name, arr) {
    if (arr) {
      return arr.indexOf(name);
    }

    return userArray.indexOf(name.toLowerCase());
  }

  /**
  * Returns the array index of a submitted video in playlist
  * @param video {Object} video to check for
  * @returns {Integer} index of submitted video
  */
  function getVideoIndex (video) {
    return playlist.map(function (e) { return e.id.videoId; }).indexOf(video.id.videoId);
  }

  /**
  * Requests connection status from clients
  */
  function refreshTimeout () {
    io.sockets.emit('getStatus');
  }

  io.sockets.on('connection', function (socket) {
    var username;

    // clear stored data for first connection
    if (!userArray.length) {
      clearExistingData();
    }

    // limit the number of connections
    if (userArray.length >= 20) {
      socket.emit('roomFull');
      return;
    }

    /**
    * Refreshes socket connection (avoids timeout)
    */
    socket.on('statusSent', function () {
      // do nothing
    });

    // send current data to new connection
    socket.emit('populateInitialData', { messages: messages,
                                         playedVideos: playedVideos,
                                         playlist: playlist,
                                         theme: currentTheme,
                                         users: userList });

    /**
    * New user wants to register a username
    * @param name {String} username to be registered
    */
    socket.on('usernameRequested', function (name) {

      // if username already registered, exit
      if (getUsernameIndex(name) > -1) {
        socket.emit('usernameError');
        return;
      }

      // update stored data
      username = name;
      userArray.push(name.toLowerCase());
      userList.push(name);

      // send out new data
      io.sockets.emit('addUser', username);
      socket.emit('usernameSuccess');
    });

    /**
    * New user is requesting the currently playing video (currentVideo)
    */
    socket.on('getCurrentVideo', function () {
      socket.emit('updateCurrentVideo', currentVideo);
    });

    /**
    * User has added a video to the queue
    * @param video {Object} video to be added
    */
    socket.on('videoAddedToQueue', function (video) {
      var index = getVideoIndex(video);

      // if video in queue, exit
      if (index > -1) {
        return;
      }

      // update stored data
      playlist.push(video);

      // send out new data
      io.sockets.emit('addVideoToQueue', video);
    });

    /**
    * User has deleted a video from the queue
    * @param video {Object} video to be removed
    */
    socket.on('videoRemovedFromQueue', function (video) {
      var index = getVideoIndex(video);

      // if video NOT in queue, exit
      if (index === -1) {
        return;
      }

      // update stored data
      playlist.splice(index, 1);

      // send out new data
      io.sockets.emit('removeVideoFromQueue', video);
    });

    /**
    * Currently playing video has been updated (new video or elapsed seconds)
    * @param video {Object} updated video
    */
    socket.on('currentVideoUpdated', function (video) {
      var range = 15; // playback range

      // update video if the startSeconds are within range, otherwise reset
      if (video.startSeconds <= (currentVideo.startSeconds + range) &&
          video.startSeconds >= (currentVideo.startSeconds - range)) {
        currentVideo = video;
      } else {
        socket.emit('updateCurrentVideo', currentVideo);
      }
    });

    /**
    * User has updated room theme
    * @param theme {String} new theme
    */
    socket.on('themeUpdated', function (theme) {

      // if theme is empty, exit
      if (!theme) {
        return;
      }

      // update stored data
      currentTheme = theme;

      // send out new data
      io.sockets.emit('updateTheme', theme);
    });

    /**
    * User has sent a new message
    * @param data {Object} message to be added
    */
    socket.on('messageSent', function (data) {
      data.timestamp = new Date(); // add timestamp
      messages.push(data);
      io.sockets.emit('addMessage', data);
    });

    /**
    * User has unpaused a video
    */
    socket.on('videoUnpaused', function () {

      // send updated playlists
      socket.emit('populateInitialData', { playedVideos: playedVideos, playlist: playlist });

      // send current video
      socket.emit('updateCurrentVideo', currentVideo);
    });

    /**
    * Currently playing video has been upvoted
    */
    socket.on('upvote', function () {
      var currentUser = currentVideo.video.username;

      // update karma
      if (!karma[currentUser]) {
        karma[currentUser] = 0;
      }

      karma[currentVideo.video.username]++;
      votes.upvotes++;
    });

    /**
    * Currently playing video has been downvoted
    */
    socket.on('downvote', function (video) {
      var currentUser = video.username;
      var index = getVideoIndex(video);
      var threshold = 0 - Math.round(userArray.length / 2);

      // update karma
      if (!karma[currentUser]) {
        karma[currentUser] = 0;
      }

      karma[currentVideo.video.username]--;
      votes.downvotes++;

      // if threshold has been reached, skip video
      if ((votes.upvotes - votes.downvotes) <= threshold) {

        // if video in queue, process
        if (index > -1) {

          // update stored data
          playlist.splice(index, 1);
          playedVideos.push(video);
          votes = { upvotes: 0, downvotes: 0 };

          // play next video
          io.sockets.emit('playNextVideo', video);
        }
      }
    });

    /**
    * Currently playing video has ended
    * @param data {Object} { video: ended/skipped video, skipped: true (optional) }
    */
    socket.on('videoEnded', function (data) {
      var index = getVideoIndex(data.video);

      // if video in queue, process
      if (index > -1) {

        // update stored data
        playlist.splice(index, 1);
        playedVideos.push(data.video);

        // play next video
        if (data.skipped) {
          io.sockets.emit('playNextVideo', data.video);
        } else {
          socket.emit('playNextVideo', data.video);
        }
      }
    });

    /**
    * User has disconnected
    */
    socket.on('disconnect', function () {

      // if user was a guest, exit
      if (!username) {
        return;
      }

      // update stored data
      userArray.splice(getUsernameIndex(username), 1);
      userList.splice(getUsernameIndex(username, userList), 1);

      // send out new data
      io.sockets.emit('removeUser', username);

      // if no more connections, clear stored data
      if (!userArray.length) {
        clearExistingData();
      }
    });
  });

  setInterval(refreshTimeout, 15000);
};
