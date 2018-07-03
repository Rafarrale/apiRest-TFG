var express = require('express'),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser'),
    ip = require('ip'),
    request = require('request'),
    cron = require('node-cron'),
    app = express(),
    port = 8000;

// Include routes
var indexRouteUsu = require('./app/routes/usuario.js');
var indexRouteHome = require('./app/routes/casa.js');
var indexRouteDisp = require('./app/routes/dispositivo.js')
var indexRouteNotificacion = require('./app/routes/notificacion.js')

var myIp = 'http://' + ip.address() + ':' + port;

//Abrimos nuestro servidor
app.listen(port);

console.log('server listening on', myIp);

// Register routes
app.use('/usuario', indexRouteUsu);
app.use('/casa', indexRouteHome);
app.use('/dispositivo', indexRouteDisp);
app.use('/notificacion', indexRouteNotificacion);

// PRUEBA request the index route
//request.post(myIp + '/');
