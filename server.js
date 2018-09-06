var express = require('express'),
    ip = require('ip'),
    app = express();

var fs = require('fs');
var https = require('https');
var port = 4433;
var key = fs.readFileSync(__dirname + '/certificados/MiNodeServer.key');
var cert = fs.readFileSync(__dirname + '/certificados/MiNodeServer.crt' );
var ca = fs.readFileSync(__dirname + '/certificados/MiCA.crt' );

// Include routes
var indexRouteUsu = require('./app/routes/usuario.js');
var indexRouteHome = require('./app/routes/casa.js');
var indexRouteDisp = require('./app/routes/dispositivo.js')
var indexRouteNotificacion = require('./app/routes/notificacion.js')

var options = {
    key: key,
    cert: cert,
    ca: ca,
    requestCert: false,
    rejectUnauthorized: false,
    };


var myIp = 'https://' + ip.address() + ':' + port;
//Abrimos nuestro servidor
//app.listen(port);
console.log('server listening on', myIp); 

https.createServer(options, app).listen(port);

// Register routes
app.use('/usuario', indexRouteUsu);
app.use('/casa', indexRouteHome);
app.use('/dispositivo', indexRouteDisp);
app.use('/notificacion', indexRouteNotificacion);

/*
app.get('/foo', function(req, res){
    console.log('Hello, I am foo.');
});
*/

