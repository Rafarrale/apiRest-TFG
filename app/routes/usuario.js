var express = require('express'),
	router = express.Router(),
	bodyParser = require('body-parser');
var Usuario = require('../models/piUserModel');
var mongoUtil = require('../models/piMlabTestDatabase');
var ObjectID = require('mongodb').ObjectID;
var nodemailer = require('nodemailer');

var numAdmins = 1; // Cambiar aqui en numero de administradoes que se van a permitir por orden de registro
// router middleware
router.use(function (req, res, next) {
	next();
});

// create application/json parser
var jsonParser = bodyParser.json()

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: true })


//Operaciones CRUD
//------------------------------------------------

mongoUtil.connectToServer(function (err) {
	var db = mongoUtil.getDb();
	// define the home page route
	router.get('/', function (req, res) {
		var thisUser = new Usuario();
		thisUser.usuario = 'Rafa';
		thisUser.pass = '1234';
		thisUser.admin = 'si';
		thisUser.email = 'watimayflewy@hotmail.es';
		res.send(thisUser);
	});

	// GET a consulta params
	router.get('/giveUsu/:usu/:pass', function (req, res) {
		var usu = req.params.usu;
		var pas = req.params.pass;
		db.collection("usuarios").findOne({ user: usu, pass: pas }, function (err, result) {
			if (err) throw err;
			if (result == null) {
				res.sendStatus(404);
			} else {
				res.send(result);
			}
		});
	});

	// GET a consulta todos
	router.get('/giveUsuario/todosUsuarios/:passCasa', function (req, res) {
		var passCasa = req.params.passCasa;
		db.collection("usuarios").find({ 'passCasa.key': passCasa }).toArray(function (err, result) {
			if (err) throw err;
			if (result == null) {
				res.sendStatus(404);
			} else {
				//res.send(result._id);
				res.send(result);
			}
		});
	});

	router.get('/eliminaKey/:passCasa/:idToken/:usuario', function (req, res) {
		var passCasa = req.params.passCasa;
		var idToken = new ObjectID(req.params.idToken);
		var usuario = req.params.usuario;
		db.collection('usuarios').findOne({ user: usuario }, function (err, resultUsuario) {
			if (err) throw err;
			var auxKeys = [];
			for (var i = 0; i < resultUsuario.passCasa.length; i++) {
				if (resultUsuario.passCasa[i].key != passCasa) {
					auxKeys.push(resultUsuario.passCasa[i]);
				}
			}
			db.collection('usuarios').updateOne({ user: usuario }, { $set: { passCasa: auxKeys } }, function (err, resUpdateUsu) {
				if (err) throw err;
				console.log('Key eliminado de usuario');
				db.collection('token').findOne({ _id: idToken }, function (err, resultToken) {
					if (err) throw err;
					var auxKeys = [];
					for (var i = 0; i < resultToken.passCasa.length; i++) {
						if (resultToken.passCasa[i].key != passCasa) {
							auxKeys.push(resultToken.passCasa[i]);
						}
					}
					db.collection('token').updateOne({ _id: idToken }, { $set: { passCasa: auxKeys } }, function (err, resUpdateToken) {
						if (err) throw err;
						console.log('Key eliminado de token');
						res.sendStatus(200);
					});
				});
			});
		});

	});

	router.get('/recuperaPass/:email', function (req, res) {
		var auxEmail = req.params.email;
		var pass;
		db.collection('usuarios').findOne({ email: auxEmail }, { pass: 1 }, function (err, result) {
			if (err) throw err;
			if (result != null) {
				pass = result.pass;
				sendMail(auxEmail, pass);
				res.sendStatus(200);
			} else {
				res.sendStatus(404);
			}
		});
	});
	router.get('/actualizaKeyToUse/:user/:keyToUse', function (req, res) {
		var user = req.params.user;
		var keyToUse = req.params.keyToUse;
		db.collection('usuarios').updateOne({ user: user }, { $set: { keyToUse: keyToUse } }, function (err, result) {
			if (err) throw err;
			if (result != null) {
				res.sendStatus(200);
			} else {
				res.sendStatus(404);
			}
		});
	});



	// POST /api/users gets urlencodedParser bodies
	router.post('/items2', urlencodedParser, function (req, res) {
		if (!req.body) return res.sendStatus(400)
		res.send('welcome, ' + req.body.usuario)
	});

	router.get('/compruebaUser/:user', jsonParser, function (req, res) {
		var user = req.params.user;
		db.collection("usuarios").findOne({ user: user }, function (err, result) {
			if (err) throw err;
			if (result == null) {
				res.sendStatus(200);
			} else {
				res.sendStatus(404);
			}
		});
	});

	// INSERT POST /api/users gets JSON bodies
	router.post('/insertUsu', jsonParser, function (req, res) {
		var myobj = req.body;
		var passCasa = myobj.passCasa;
		var keyToUse = myobj.keyToUse;
		var query = { 'passCasa.key': passCasa[keyToUse].key, admin: "si" };
		var params = { _id: 1 }
		db.collection("clave").findOne({ numSerie: passCasa[keyToUse].key }, { _id: 1 }, function (err, result) {
			if (result != null) {
				db.collection("usuarios").find(query, params).toArray(function (err, result) {
					if (err) throw err;
					if (result.length <= numAdmins - 1) {
						var admin = 'si';
						myobj['admin'] = admin;
						db.collection("usuarios").insertOne(myobj, function (err, obj) {
							console.log("1 document inserted");
							res.sendStatus(200);
						});
					} else {
						var admin = 'no';
						myobj['admin'] = admin;
						db.collection('usuarios').insertOne(myobj, function (err, obj) {
							console.log("1 document inserted");
							res.sendStatus(200);
						});
					}
				});
			} else {
				res.sendStatus(404);
			}
		});
	});

	// UPDATE POST ----------- Usando _Id 
	router.post('/actUsu', jsonParser, function (req, res) {
		if (!req.body) return res.sendStatus(400)
		var myId = req.body._id;
		var myNombre = req.body.nombre;
		var myApellidos = req.body.apellidos;
		var myUser = req.body.user;
		var myPass = req.body.pass;
		var myAdmin = req.body.admin;
		var myEmail = req.body.email;
		var query = { _id: new ObjectID(myId) };
		var newvalues = { $set: { user: myUser, nombre: myNombre, apellidos: myApellidos, pass: myPass, email: myEmail, admin: myAdmin } };
		db.collection("usuarios").updateOne(query, newvalues, function (err, result) {
			if (err) throw err;
			var s = result;
			if (result.matchedCount == 0) {
				res.sendStatus(404);
			} else {
				res.sendStatus(200);
			}
		});
	});
	// Delete
	router.delete('/eliminaUsuario', jsonParser, function (req, res) {
		var miUser = req.body.user;
		var miPass = req.body.pass;
		var miEmail = req.body.email;
		var myquery = { user: miUser, pass: miPass, email: miEmail };
		db.collection("usuarios").deleteOne(myquery, function (err, obj) {
			if (err) throw err;
			console.log("1 document deleted");
			res.send('200 ok');
		});
	});

});

function sendMail(correo, password) {
	let transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			type: 'OAuth2',
			user: 'motiCasaDomotica@gmail.com',
			clientId: '437018414764-3b49nvc0g0gmrmiconnicpsdf75657kf.apps.googleusercontent.com',
			clientSecret: '8Q3EtYXPHElVRVjzvUmsB8b-',
			refreshToken: '1/QgwSP8vBbTeSXrHv6dGluJU3XN9t8pj6cZ5R8RQXerY'
		}
	})

	let mailOptions = {
		from: '<motiCasaDomotica@gmail.com>',
		to: correo,
		subject: 'Aqui tiene su clave de seguridad',
		html: '<h1>Contraseña</h1><h2>' + password + '</h2>' + '<h3>Por favor elimine este correo una vez lo halla leído</h3>'
	}

	transporter.sendMail(mailOptions, function (err, info) {
		if (err) {
			console.log('Error');
		} else {
			console.log('Email de recuperacion enviado');
		}
		/*
			res.statusCode = 200
			res.end('Email sent!')
		*/
	})
}



module.exports = router;
