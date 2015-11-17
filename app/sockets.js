// app/sockets.js

module.exports = function (io) {
  var currentTheme = null; // keeps track of room theme
  var currentVideo = { video: null, startSeconds: 0 }; // keeps track of currently playing video
  var messages = []; // keeps track of chat messages
  var playedVideos = []; // keeps track of video history
  var playlist = []; // keeps track of video queue
  var userArray = []; // keeps track of toLowerCase() usernames (for uniqueness checks)
  var userList = []; // keeps track of submitted usernames

  /**
  * Clears existing data
  */
  function clearExistingData () {
    currentTheme = null;
    currentVideo = { video: null, startSeconds: 0 };
    messages = [];
    playedVideos = [];
    playlist = [];
    userArray = [];
    userList = [];
  }

  /**
  * Returns the array index of a submitted username in userArray/userList
  * @param name {String} username to check for
  * @param toggle {Boolean} indicates which array to search in
  * @returns {Integer} index of submitted username
  */
  function getUsernameIndex (name, list) {
    if (list) {
      return userList.indexOf(name);
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
      console.log('Connection refreshed.');
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
      currentVideo = video;
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
    * Currently playing video has ended
    * @param data {Object} { video: ended/skipped video, skipped: true (optional) }
    */
    socket.on('videoEnded', function (data) {
      var index = getVideoIndex(data.video);

      // if video in queue, process
      if (index > -1) {
        playlist.splice(index, 1);
        playedVideos.push(data.video);
      }

      if (data.skipped) { // broadcast to everyone!!!
        io.sockets.emit('playNextVideo', data.video);
      } else {
        socket.emit('playNextVideo', data.video);
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
      userList.splice(getUsernameIndex(username, true), 1);

      // send out new data
      io.sockets.emit('removeUser', username);

      // if no more connections, clear stored data
      if (!userArray.length) {
        clearExistingData();
      }
    });
  });

  setTimeout(refreshTimeout, 10000);
};
