// app/sockets.js

module.exports = function (io, adminPassword) {
  var currentTheme = null; // keeps track of room theme
  var currentVideo = { video: null, startSeconds: 0 }; // keeps track of currently playing video
  var karma = {}; // keeps track of user upvotes/downvotes
  var messages = []; // keeps track of chat messages
  var playedVideos = []; // keeps track of video history
  var playlist = []; // keeps track of video queue
  var userArray = []; // keeps track of toLowerCase() usernames (for uniqueness checks)
  var userList = []; // keeps track of submitted usernames
  var userMap = {}; // maps usernames to socket IDs
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
    userMap = {};
    votes = { upvotes: 0, downvotes: 0 };
  }

  /**
  * Checks for image URL in message
  * @param message {String} message to check in
  * @returns {Boolean} if message contains valid image URL
  */
  function checkForImage (message) {

    // if message contains spaces, exit
    if (message.indexOf(' ') > -1) {
      return false;
    }

    if (/(jpg|gif|png|JPG|GIF|PNG|JPEG|jpeg)$/.test(message)) {
      return true;
    }

    return false;
  }

  /**
  * Checks for a non-image URL in message
  * @param message {String} message to check in
  * @returns {Boolean} if message contains valid URL
  */
  function checkForUrl (message) {

    // if message contains spaces, exit
    if (message.indexOf(' ') > -1) {
      return false;
    }

    var pattern = new RegExp('(http|ftp|https)://[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?');
    return pattern.test(message);
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

    /**
    * Client is still connected
    */
    socket.on('updateStatus', function () {
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

      username = name;
      userArray.push(name.toLowerCase());
      userList.push(name);
      userMap[name] = socket.id;

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
    * @param data {Object} video data and elapsed time
    */
    socket.on('currentVideoUpdated', function (data) {
      currentVideo = data;
    });

    /**
    * User is attempting to register as an admin
    * @param password {String} admin password
    */
    socket.on('adminStatusRequested', function (password) {

      // if no password, exit
      if (!password) {
        return;
      }

      if (adminPassword === password) {
        isAdmin = true;
        socket.emit('updateAdminStatus');
      }
    });

    /**
    * User has kicked out another user
    * @param username {String} username of user getting kicked out
    */
    socket.on('userKicked', function () {
      // TODO: implement
    });

    /**
    * User has updated room theme
    * @param theme {String} new theme
    */
    socket.on('themeUpdated', function (theme) {

      // if user is not admin, exit
      if (!isAdmin) {
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

      // check for image
      if (checkForImage(data.message)) {
        data.message = '<img src="' + data.message + '" alt="' + data.message + '"/>';
      }

      // check for url
      if (!checkForImage(data.message) && checkForUrl(data.message)) {
        data.message = '<a href="' + data.message + '" target="_blank">' + data.message + '</a>';
      }

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
        votes = { upvotes: 0, downvotes: 0 }; // reset votes!
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
      delete userMap[username];

      // send out new data
      io.sockets.emit('removeUser', username);

      // if no more connections, clear stored data
      if (!userArray.length) {
        clearExistingData();
      }
    });
  });

  // ping clients to keep connection open
  setInterval(function () {
    io.sockets.emit('getStatus');
  }, 15000);
};
