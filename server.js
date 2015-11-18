// server.js

// SET UP
// =============================================
var bodyParser     = require('body-parser');
var express        = require('express');
var app            = express();
var methodOverride = require('method-override');
var port           = process.env.PORT || 3000;
var server         = require('http').createServer(app);
var io             = require('socket.io').listen(server);

// CONFIGURATION
// =============================================
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());

// routes and sockets
require('./app/routes')(app);
require('./app/sockets')(io, { username: 'brandizzle' });

// START SERVER (node server.js)
// =============================================
server.listen(port);
console.log('App listening on port ' + port);
