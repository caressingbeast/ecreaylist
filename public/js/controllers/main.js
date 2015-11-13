(function () {
  'use strict';

  function MainCtrl (socket, VideoService) {
    var c = this;

    c.query = '';
    c.playedVideos = [];
    c.playlist = [];
    c.results = [];

    // socket events
    socket.on('playlist:get', function () {
      socket.emit('sendPlaylist', c.playlist);
    });

    socket.on('playlist:refresh', function (playlist) {
      console.log(playlist);
      c.playlist = playlist;
    });

    c.search = function () {
      VideoService.search(c.query)
        .then(function (res) {
          c.results = res.data.items;
        }, function (err) {
          console.log(err);
        });
    };

    c.add = function (index, video) {
      c.playlist.push(video);
      c.results.splice(index, 1);

      socket.emit('refreshPlaylist', c.playlist);
    };

    c.delete = function (index) {
      c.playlist.splice(index, 1);

      socket.emit('refreshPlaylist', c.playlist);
    };
  }

  angular.module('ecreaylist')
    .controller('MainCtrl', MainCtrl);
})();
