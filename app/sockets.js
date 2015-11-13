// app/sockets.js

module.exports = function (app, io) {

  io.sockets.on('connection', function (socket) {
    socket.broadcast.emit('playlist:get');

    socket.on('sendPlaylist', function (playlist) {
      socket.broadcast.emit('playlist:refresh', playlist);
    });

    socket.on('refreshPlaylist', function (playlist) {
      io.sockets.emit('playlist:refresh', playlist);
    });
  });
};
