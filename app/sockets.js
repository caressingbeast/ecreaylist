// app/sockets.js

module.exports = function (app, io) {
  var currentVideo = { video: null, startSeconds: 0 }; // keeps track of currently playing video
  var messages = []; // keeps track of chat messages
  var playedVideos = []; // keeps track of video history
  var playlist = []; // keeps track of video queue
  var userArray = []; // keeps track of unique usernames
  var userList = []; // keeps track of submitted usernames

  /**
  * Returns the array index of a submitted username in userArray/userList
  * @param name String username to check for
  * @param toggle Boolean indicates which array to search in
  */
  function getUsernameIndex (name, toggle) {
    if (!name) {
      return false;
    }

    if (toggle) {
      return userList.indexOf(name);
    }

    return userArray.indexOf(name.toLowerCase());
  }

  /**
  * Returns the array index of a submitted video in playlist
  * @param video Object video object to check for
  */
  function getVideoIndex (video) {
    return playlist.map(function (e) { return e.id.videoId; }).indexOf(video.id.videoId);
  }

  io.sockets.on('connection', function (socket) {
    var username;

    // too many connections
    if (userArray.length >= 20) {
      socket.emit('roomFull');
      return;
    }

    // send current data to new connection
    socket.emit('populateInitialData', { messages: messages,
                                         playlist: playlist,
                                         playedVideos: playedVideos,
                                         users: userList });

    // new user is submitting username
    socket.on('usernameRequested', function (name) {
      if (getUsernameIndex(name) > -1) {
        socket.emit('usernameError');
        return;
      }

      // update stored data
      username = name;
      userArray.push(name.toLowerCase());
      userList.push(name);

      // send out new user data
      io.sockets.emit('addUser', username);
      socket.emit('usernameSuccess');
    });

    // send current video
    socket.on('getCurrentVideo', function () {
      socket.emit('updateCurrentVideo', currentVideo);
    });

    // someone added a video to the queue
    socket.on('videoAddedToQueue', function (video) {
      playlist.push(video);
      io.sockets.emit('addVideoToQueue', video);
    });

    // someone removed a video from the queue
    socket.on('videoRemovedFromQueue', function (video) {
      var index = getVideoIndex(video);

      playlist.splice(index, 1);
      io.sockets.emit('removeVideoFromQueue', video);
    });

    // currently playing video has updated
    socket.on('currentVideoUpdated', function (video) {
      currentVideo = video;
    });

    // someone sent a new message
    socket.on('messageSent', function (data) {
      messages.push(data);
      io.sockets.emit('addMessage', data);
    });

    // currently playing video has ended
    socket.on('videoEnded', function (video) {
      var index = getVideoIndex(video);

      if (index > -1) {
        playlist.splice(index, 1);
        playedVideos.push(video);
      }

      socket.emit('playNextVideo', video);
    });

    socket.on('disconnect', function () {
      if (!username) {
        return;
      }

      userArray.splice(getUsernameIndex(username), 1);
      userList.splice(getUsernameIndex(username, true), 1);

      io.sockets.emit('removeUser', username);

      // clear data if no connections
      if (!userArray.length) {
        currentVideo = { video: null, startSeconds: 0 };
        messages = [];
        playedVideos = [];
        playlist = [];
        userArray = [];
        userList = [];
      }
    });
  });
};
