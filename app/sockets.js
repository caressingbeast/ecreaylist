// app/sockets.js

module.exports = function (io, secret) {
  var admin = false; // keeps track if admin registered
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
    admin = false;
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
  * Moves a video from  queue to history
  * @param video {Object} currently playing video
  */
  function shiftVideo (video) {
    var index = getVideoIndex(video);

    // if video in queue, process
    if (index > -1) {
      playlist.splice(index, 1);
      playedVideos.push(video);
    }
  }

  /**
  * Upvotes the vote count
  * @param type {String} type of vote to count (upvote/downvote)
  * @param video {Object} video being voted on
  */
  function updateVotes (type, video) {

    // if no type or video, exit
    if (!type || !video) {
      return;
    }

    // if no karma yet, init
    if (!karma[video.username]) {
      karma[video.username] = 0;
    }

    // update votes
    if (type === 'upvote') {
      karma[video.username]++;
      votes.upvotes++;
    } else {
      karma[video.username]--;
      votes.downvotes++;
    }
  }

  io.sockets.on('connection', function (socket) {
    var isAdmin = false;
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

    socket.on('adminRegistered', function (password) {

      // if admin already registered, exit
      if (admin) {
        return;
      }

      if (password === secret.phrase) {
        admin = true;
        isAdmin = true;
        socket.emit('updateIsAdmin');
      }
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
    * @param data {Object} video data and elapsed time
    */
    socket.on('currentVideoUpdated', function (data) {
      currentVideo = data;
    });

    /**
    * User has updated room theme
    * @param theme {String} new theme
    */
    socket.on('themeUpdated', function (theme) {

      // if theme is empty or user is not admin, exit
      if (!isAdmin || !theme) {
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
    socket.on('upvote', function (video) {
      updateVotes('upvote', video);
    });

    /**
    * Currently playing video has been downvoted
    * @param video {Object} video that was downvoted
    */
    socket.on('downvote', function (video) {
      var threshold = 0 - Math.round(userArray.length / 2);

      updateVotes('downvote', video);

      // if threshold has been reached, skip video
      if ((votes.upvotes - votes.downvotes) <= threshold) {
        shiftVideo(video);
        io.sockets.emit('playNextVideo', video);
      }
    });

    /**
    * Currently playing video has ended
    * @param video {Object} video that ended
    */
    socket.on('videoEnded', function (video) {
      shiftVideo(video);
      socket.emit('playNextVideo', video);
    });

    /**
    * Currently playing video has been skipped
    * @param video {Object} video to be skipped
    */
    socket.on('videoSkipped', function (video) {

      // if user is not admin, exit
      if (!isAdmin) {
        return;
      }

      shiftVideo(video);
      io.sockets.emit('playNextVideo', video);
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
};
