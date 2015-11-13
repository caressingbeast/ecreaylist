// app/routes.js

module.exports = function (app, io) {

  app.get('*', function (req, res) {
    res.sendfile('./public/index.html');
  });
};
