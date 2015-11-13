// app/sockets.js

module.exports = function (app, io) {
  var currentVideo = null;
  var messages = [];
  var playedVideos = [];
  var playlist = [];
  var userArray = [];
  var userList = [];

  function getUsernameIndex (name, toggle) {
    if (toggle) {
      return userList.indexOf(name);
    }

    return userArray.indexOf(name.toLowerCase());
  }

  io.sockets.on('connection', function (socket) {
    var username;

    if (userArray.length >= 20) {
      socket.emit('roomFull');
      return;
    }

    socket.emit('refreshMessages', messages);
    socket.emit('refreshPlaylists', { playlist: playlist, playedVideos: playedVideos });
    socket.emit('refreshUsers', userList);

    socket.on('usernameRequest', function (name) {
      if (getUsernameIndex(name) > -1) {
        socket.emit('usernameError');
        return;
      }

      // update stored data
      username = name;
      userArray.push(name.toLowerCase());
      userList.push(name);

      // send out new data
      io.sockets.emit('refreshUsers', userList);
      socket.emit('usernameSuccess');

      if (currentVideo) {
        socket.emit('playCurrentVideo', currentVideo);
      }
    });

    socket.on('playlistAdd', function (video) {
      playlist.push(video);
      socket.emit('refreshPlaylists', { playlist: playlist, playedVideos: playedVideos });
    });

    socket.on('playlistDelete', function (index) {
      playlist.splice(index, 1);
      socket.emit('refreshPlaylists', { playlist: playlist, playedVideos: playedVideos });
    });

    socket.on('updateCurrentVideo', function (video) {
      currentVideo = video;
    });

    socket.on('messageSent', function (data) {
      messages.push(data);
      io.sockets.emit('refreshMessages', messages);
    });

    socket.on('videoEnded', function (video) {
      console.log(video);
      var index = playlist.map(function (e) { return e.id.videoId; }).indexOf(currentVideo.video.id.videoId);

      playlist.splice(index, 1);
      playedVideos.push(video);

      io.sockets.emit('playNextVideo');
    });

    socket.on('disconnect', function () {
      if (!username) {
        return;
      }

      userArray.splice(getUsernameIndex(username), 1);
      userList.splice(getUsernameIndex(username, true), 1);

      io.sockets.emit('refreshUsers', userList);

      // clear data if no connections
      if (!userArray.length) {
        currentVideo = null;
        messages = [];
        playedVideos = [];
        playlist = [];
        userArray = [];
        userList = [];
      }
    });
  });
};
