var express = require('express'),
	bodyParser = require('body-parser'),
	router = express.Router();
var firebase = require('firebase-admin');
var mongoUtil = require('../models/piMlabTestDatabase');
var ObjectID = require('mongodb').ObjectID;
var FCM = require('fcm-push');
var ObjectID = require('mongodb').ObjectID;
var mqtt = require('mqtt');
var jsonParser = bodyParser.json()

// router middleware
router.use(function (req, res, next) {
	next();
});


var serviceAccount = require('..//..//credencialesFirebase/tfgfirebaseproject-ccbd3-firebase-adminsdk-wmssi-f36f73a786.json');

firebase.initializeApp({
	credential: firebase.credential.cert(serviceAccount),
	databaseURL: 'https://tfgfirebaseproject-ccbd3.firebaseio.com'
});

//Operaciones Inserta y Actualiza Token
//------------------------------------------------
/***/
mongoUtil.connectToServer(function (err) {
	var db = mongoUtil.getDb();

	router.post('/insertaToken', jsonParser, function (req, res) {
		var myobj = req.body;
		var token = req.body.token;
		var passCasa = req.body.passCasa;
		var keyToUse = req.body.keyToUse;
		var casa = req.body.casa;
		var id = new ObjectID(req.body._id);

		db.collection("token").findOne({ _id: id }, function (err, resultFindToken) {
			if (err) throw err;
			if (resultFindToken == null) {
				// No Existe el token
				delete myobj['_id'];
				db.collection("token").insertOne(myobj, function (err, resultToken) {
					if (err) throw err;
					console.log("Token insertado en collection token");
					db.collection("casa").find({ passCasa: passCasa[keyToUse].key }, { tokens: 1, _id: 0, homeUsu: 1 }).toArray(function (err, result) {
						if (err) throw err;
						if (result.length != 0) {
							// No existe el token pero si hay casas
							var existe = false;
							for (var i = 0; i < result.length; i++) {
								var jsonArray = [];
								for (var x = 0; x < result[i].tokens.length; x++) {
									if (result[i].tokens[x].token == myobj.token) {
										if (!existe) {
											existe = true;
										}
									}
								}
								jsonArray = result[i].tokens;
								if (!existe) {
									var copyMyObj = Object.assign({}, myobj);
									delete copyMyObj['passCasa'];
									delete copyMyObj['keyToUse'];
									copyMyObj['passCasa'] = passCasa[keyToUse].key;
									jsonArray.push(copyMyObj);
								}

								var auxHome = result[i].homeUsu;
								db.collection("casa").updateOne({ "homeUsu": auxHome }, { $set: { "tokens": jsonArray } }, function (err, result) {
									if (result != null) {
										console.log("Actualizado correctamente tokens de la casa: " + auxHome);
									} else {
										console.log("No se actualizó correctamente tokens de la casa: " + auxHome);
									}
								});
							}
							res.send(myobj);
						} else {
							res.send(myobj);
						}
					});
				});
				// else --> Existe el token
			} else {
				// Existe el token y es distinto
				if (resultFindToken.token != token) {
					db.collection("token").updateOne({ _id: id }, { $set: { token: token } }, function (err, result) {
						console.log("Token actualizado");
						db.collection("casa").find({ passCasa: passCasa[keyToUse].key }).toArray(function (err, result) {
							if (err) throw err;
							if (result.length != 0) {
								for (var i = 0; i < result.length; i++) {
									var existe = false;
									var jsonArray = [];
									for (var x = 0; x < result[i].tokens.length; x++) {
										if (JSON.stringify(result[i].tokens[x]._id) == JSON.stringify(id)) {
											var auxResultFindToken = Object.assign({}, resultFindToken);
											auxResultFindToken.token = token;
											var auxPassCasa = auxResultFindToken.passCasa[keyToUse].key;
											delete auxResultFindToken['keyToUse'];
											delete auxResultFindToken['passCasa'];
											auxResultFindToken['passCasa'] = auxPassCasa;
											jsonArray.push(auxResultFindToken);
										} else {
											jsonArray.push(result[i].tokens[x]);
										}
									}
									var auxHome = result[i].homeUsu;
									db.collection("casa").updateOne({ "homeUsu": auxHome }, { $set: { "tokens": jsonArray } }, function (err, result) {
										if (result != null) {
											console.log("Actualizado correctamente tokens de la casa no existente: " + auxHome);
										} else {
											console.log("No se actualizó correctamente tokens de la casa no existente: " + auxHome);
										}
									});
								}
							}
						});
					});
					// else --> Existe el token y es igual
				} else {
					console.log("El token no ha cambiado");
				}
			}
		});
	});
	router.post('/insertaTokenCasa', jsonParser, function (req, res) {
		var myobj = req.body;
		var token = req.body.token;
		var passCasa = req.body.passCasa;
		var keyToUse = req.body.keyToUse;
		var casa = req.body.casa;
		var id = new ObjectID(req.body._id);
		var jsonArray = [];
		delete myobj['casa'];
		delete myobj['passCasa'];
		delete myobj['keyToUse'];
		delete myobj['_id'];
		myobj['passCasa'] = passCasa[keyToUse].key;
		myobj['_id'] = id;
		jsonArray.push(myobj);
		db.collection("casa").updateOne({ homeUsu: casa }, { $set: { "tokens": jsonArray } }), (function (err, result) {
			if (result != null) {
				console.log("Token insertado en casa");
				res.send(200);
			} else {
				res.send(404);
			}
		});
	});

	/***/
	router.get('/notificaTodos/:id/:mensaje', function (req, res) {
		var id = req.params.id;
		var mensaje = req.params.mensaje;
		enviarNotificacion(token, mensaje);
		res.sendStatus(200);
	});

	router.post('/alarmaVentana', jsonParser, function (req, res) {
		var auxId = req.body._id;
		var id = new ObjectID(auxId);
		var habitacion = req.body.habitacion;
		var casa = req.body.casa;
		var name = req.body.name;
		var mensaje = "Sensor Ventana de la Habitación " + habitacion + " : " + name;
		db.collection("casa").findOne({ "tokens._id": id }, { tokens: 1, _id: 0 }, function (err, result) {
			if (result != null) {
				res.send(200);
				for (var i = 0; i < result.tokens.length; i++) {
					enviarNotificacion(result.tokens[i].token, mensaje, casa);
				}
			} else {
				res.send(404);
			}
		});
	});
});

function enviarNotificacion(tokenDestinatario, mensaje, casa) {
	var serverKey = 'AIzaSyCjL31mlg28WQ3MvVFhqStFNeFGTuW7TS0';
	var fcm = new FCM(serverKey);

	var message = {
		to: tokenDestinatario, // required fill with device token or topics
		collapse_key: 'your_collapse_key',
		data: {
			"data": {
				"title": "Alerta " + casa,
				"message": mensaje,
				"image": "null"
			}
		},
		notification: {
		}
	};

	//callback style
	fcm.send(message, function (err, response) {
		var receptor = message.to;
		if (err) {
			console.log("Something has gone wrong!");
			// Como no existe lo eliminamos de la BBDD
			mongoUtil.connectToServer(function (err) {
				var db = mongoUtil.getDb();
				db.collection('token').deleteOne({ token: receptor }, function (err, result) {
					if (err) throw err;
					console.log("Token de collection <token>: " + receptor + " eliminado");
					db.collection('casa').findOne({ homeUsu: casa }, { tokens: 1 }, function (err, result) {
						if (err) throw err;
						if (result != null) {
							var aux = result.tokens;
							var auxRes = [];
							for (var i = 0; i < aux.length; i++) {
								if (aux[i].token != receptor) {
									auxRes.push(aux[i]);
								}
							}
							db.collection('casa').updateOne({ homeUsu: casa }, { $set: { tokens: auxRes } }, function (err, resultAct) {
								if (err) throw err;
								if (resultAct != null) {
									console.log("Token de collection <casa>: " + receptor + " eliminado");
								}
							});
						}
					});
				});
			})
		} else {
			console.log("Successfully sent with response: ", response);
		}
	});

	/*
		//promise style
		fcm.send(message)
			.then(function(response){
				console.log("Successfully sent with response: ", response);
			})
			.catch(function(err){
				console.log("Something has gone wrong!");
				console.error(err);
				var token = response.to;
				var es;
			})
	*/
}
module.exports = router;
module.exports.func = enviarNotificacion;
