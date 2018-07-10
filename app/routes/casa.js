var express = require('express'),
	router = express.Router(),
	bodyParser = require('body-parser');
var Usuario = require('../models/piUserModel');
var mongoUtil = require('../models/piMlabTestDatabase');
var mqtt = require('../models/mqtt')

/** Constantes */
var constElimina = "elimina";
var constConfAlarma = "confAlarma";
var constAlarma = "alarma";
var constResponseAlarma = 'respAlarma';
var constResponseInterruptor = 'respInterruptor';
var ObjectID = require('mongodb').ObjectID;

// router middleware
router.use(function (req, res, next) {
	next();
});

// create application/json parser
var jsonParser = bodyParser.json()

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: true })


/** MQTT */
var client = mqtt.connectToMQTT;
mqtt.subscribe(client, constAlarma);
mqtt.subscribe(client, constConfAlarma);
mqtt.subscribe(client, constResponseAlarma);
mqtt.subscribe(client, constResponseInterruptor);
mqtt.subscribe(client, 'idRegistra');
mqtt.subscribe(client, 'bateria');
mqtt.recibeAlarmas(client);
mqtt.recibeEstadoBateria(client);
mqtt.configuraDispositivos(client);
mqtt.responseEstadoDispositivos(client);
mqtt.responseEstadoInterruptor(client);
mqtt.recibeId(client);
mqtt.recibeEstadoSensor(client);


var consDesarmar = "desarmar";
var constO = 'O';


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

	// POST a consulta params
	router.post('/giveHomeUsu', jsonParser, function (req, res) {
		var homeUsuRest = req.body.homeUsu;

		db.collection("casa").findOne({ homeUsu: homeUsuRest }, function (err, result) {
			if (err) throw err;
			if (result == null) {
				res.sendStatus(404);
			} else {
				res.sendStatus(200);
			}
		});
	});

	// GET todas las casa
	router.get('/giveHome/todasCasas/:numSerie', function (req, res) {
		var numSerie = req.params.numSerie;
		db.collection("casa").find({ passCasa: numSerie }).toArray(function (err, result) {
			if (err) throw err;
			if (result == null) {
				res.sendStatus(404);
			} else {
				res.send(result);
			}
		});
	});

	// GET todas las casa
	router.get('/actualizaTokenUsuario/:passCasa/:idToken/:usuario', function (req, res) {
		var passCasa = req.params.passCasa;
		var idToken = new ObjectID(req.params.idToken);
		var usuario = req.params.usuario;
		var existePassCasa = false;
		var auxPassCasa;
		var aux = {};
		aux['key'] = passCasa;
		db.collection("clave").findOne({ numSerie: passCasa }, function (err, resultClave) {
			if (err) throw err;
			if (resultClave != null) {
				db.collection("token").findOne({ _id: idToken }, function (err, resultToken) {
					if (err) throw err;
					if (resultToken != null) {
						for (var i = 0; i < resultToken.passCasa.length; i++) {
							if (resultToken.passCasa[i].key == passCasa) {
								existePassCasa = true;
							}
						}
						if (existePassCasa) {
							existePassCasa = false;
							db.collection("usuarios").findOne({ user: usuario }, function (err, resultUsuario) {
								if (err) throw err;
								for (var i = 0; i < resultUsuario.passCasa.length; i++) {
									if (resultUsuario.passCasa[i].key == passCasa) {
										existePassCasa = true;
									}
								}
								if (existePassCasa) {
									res.send(404);
								} else {
									auxPassCasa = resultUsuario.passCasa;
									auxPassCasa.push(aux);
									db.collection("usuarios").updateOne({ user: usuario }, { $set: { passCasa: auxPassCasa } }, function (err, resultUsuario) {
										if (err) throw err;
										console.log("passCasa de usuario actualizado");
										res.sendStatus(200);
									});
								}
							});
						} else {
							existePassCasa = false;
							auxPassCasa = resultToken.passCasa;
							auxPassCasa.push(aux);
							db.collection("token").updateOne({ _id: idToken }, { $set: { passCasa: auxPassCasa } }, function (err, resultToken) {
								if (err) throw err;
								console.log("passCasa de token actualizado");
								db.collection("usuarios").findOne({ user: usuario }, function (err, resultUsuario) {
									if (err) throw err;
									for (var i = 0; i < resultUsuario.passCasa.length; i++) {
										if (resultUsuario.passCasa[i].key == passCasa) {
											existePassCasa = true;
										}
									}
									if (existePassCasa) {
										res.send(404);
									} else {
										auxPassCasa = resultUsuario.passCasa;
										auxPassCasa.push(aux);
										db.collection("usuarios").updateOne({ user: usuario }, { $set: { passCasa: auxPassCasa } }, function (err, resultUsuario) {
											if (err) throw err;
											console.log("passCasa de usuario actualizado");
											res.sendStatus(200);
										});
									}
								});
							});
						}
					} else {
						res.send(404);
					}
				});
			} else {
				/** Si la clave no se encuentra regsitrada */
				res.send(403);
			}
		});
	});


	router.get('/giveEstado/:estadoAlarma/:homeUsu', function (req, res) {
		var auxEstadoAlarma = req.params.estadoAlarma;
		var auxHomeUsu = req.params.homeUsu;
		var query = { homeUsu: auxHomeUsu };
		var newValues = { $set: { "configuracion.estadoAlarma": auxEstadoAlarma } }
		var dispositivos;
		db.collection("casa").updateOne(query, newValues, function (err, result) {
			db.collection("casa").findOne({ homeUsu: auxHomeUsu }, { configuracion: 1, passCasa: 1, tokens: 1, dispositivos: 1 }, function (err, result) {
				if (err) throw err;
				if (result == null) {
					res.sendStatus(404);
				} else {
					dispositivos = result.dispositivos;
					if (dispositivos != null) {
						if (dispositivos.length != 0) {
							for (var i = 0; i < dispositivos.length; i++) {
								// Mandamos el estado de la alarma a los dispositivos
								var auxConfAlarma = constConfAlarma + '/' + dispositivos[i].mac;
									mqtt.publish(client, auxConfAlarma, auxEstadoAlarma);
								if (auxEstadoAlarma == consDesarmar) {
									//alarma#idDisp#activar# 
									var desactivaAlarma = constAlarma + '#' + dispositivos[i]._id + '#' + constO + '#';
									mqtt.publish(client, constAlarma, desactivaAlarma);
								}
							}

						}
					}
					res.send(result);
				}
			});
		}); 
	});

	// POST /api/users gets urlencodedParser bodies
	router.post('/items2', urlencodedParser, function (req, res) {
		if (!req.body) return res.sendStatus(400)
		res.send('welcome, ' + req.body.usuario)
	});

	// INSERT POST /api/users gets JSON bodies
	router.post('/insertCasa', jsonParser, function (req, res) {
		var myobj = req.body;
		var homeUsuRest = req.body.homeUsu;
		db.collection("casa").insertOne(myobj, function (err, result) {
			if (err) throw err;
			console.log("1 document inserted");
		});
		res.sendStatus(200);
	});

	// UPDATE POST /api/users gets JSON bodies
	router.post('/actHome', jsonParser, function (req, res) {
		if (!req.body) return res.sendStatus(400)
		var myNombre = req.body.nombre;
		var myApellidos = req.body.apellidos;
		var myUser = req.body.user;
		var myPass = req.body.pass;
		var myAdmin = req.body.admin;
		var myEmail = req.body.email;
		var query = { nombre: myNombre, apellidos: myApellidos };
		var aux = "";
		db.collection("usuarios").find(query).toArray(function (err, result) {
			if (err) throw err;
			aux = result[0];
			aux = aux._id;
			query = { _id: aux };
			var newvalues = { $set: { user: myUser, pass: myPass, email: myEmail, admin: myAdmin } };
			db.collection("usuarios").updateOne(query, newvalues, function (err, res) {
				if (err) throw err;
			});
		});
		//Pruebas
		// create user in req.body
		res.send("content-type", "application/json; charset=utf-8");
	});


	// Delete elimina con condicion or ya se tenga el _id o el nombre
	router.delete('/eliminaCasa', jsonParser, function (req, res) {
		var miId = req.body._id;
		var miHomeUsu = req.body.homeUsu;
		var myquery = { $or: [{ _id: miId }, { homeUsu: miHomeUsu }] };
		db.collection("casa").findOne(myquery, { dispositivos: 1 }, function (err, obj) {
			if(obj.dispositivos != null){
				for(var i = 0; i < obj.dispositivos.length; i++){
					var idDisp = (obj.dispositivos[i]._id).toString();
					client.publish(idDisp, constElimina, { qos: 1, retain: false });
				}
			}
			db.collection("casa").deleteOne(myquery, function (err, obj) {
				if (err) throw err;
				console.log("1 document deleted");
				res.send('200 ok');
			});
		});
	});
});



module.exports = router;
