var express = require('express'),
	router = express.Router(),
	bodyParser = require('body-parser');
var Usuario = require('../models/piUserModel');
var mongoUtil = require('../models/piMlabTestDatabase');
var logDisp = require('../models/modules');
var ObjectID = require('mongodb').ObjectID;
var mqtt = require('../models/mqtt')

// router middleware
router.use(function (req, res, next) {
	next();
});

// create application/json parser
var jsonParser = bodyParser.json()

var constEstado = 'estado';
var estadoInicialDisp = 'conectado';
var constElimina = "elimina";
var constDispAñadido = "Añadido";
var constConfAlarma = 'confAlarma';
var constConfInterruptor = 'confInterruptor';
var constResponseInterruptor = 'respInterruptor';



// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: true })

/** MQTT */
var client = mqtt.connectToMQTT;

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

	router.get('/giveDispTodos/:homeUsu/:tipo', jsonParser, function (req, res) {
		var homeUsuRest = req.params.homeUsu;
		var tipoRest = req.params.tipo;
		var query = { homeUsu: homeUsuRest };
		var filtro = { dispositivos: 1 }; 
		db.collection("casa").findOne(query, filtro, function (err, result) {  // TODO: collection null solucionar
			if (err) throw err;
			if (result == null || result.dispositivos == null) {
				var auxEmpty = [{}];
				res.send(auxEmpty);
			} else {
				if (tipoRest == 'todos') {
					for(var i = 0; i < result.dispositivos.length; i++){
						delete result.dispositivos[i]['claveDisp'];
						delete result.dispositivos[i]['mac'];
						delete result.dispositivos[i]['log'];
					}
					res.send(result.dispositivos);
				} else {
					var aux = [];
					for (var i = 0; i < result.dispositivos.length; i++) {
						if (result.dispositivos[i].tipo == tipoRest) {
							aux.push(result.dispositivos[i]);
						}
					}
					res.send(aux);
				}
			}
		});
	});

	router.get('/giveEstado/:estadoAlarma/:homeUsu', function (req, res) {
		var auxEstadoAlarma = req.params.estadoAlarma;
		var auxHomeUsu = req.params.homeUsu;
		var query = { homeUsu: auxHomeUsu };
		var newValues = { $set: { "configuracion.estadoAlarma": auxEstadoAlarma } }
		db.collection("casa").updateOne(query, newValues, function (err, result) {
			db.collection("casa").findOne({ homeUsu: auxHomeUsu }, { _id: 0, homeUsu: 0, dispositivos: 0, camaras: 0, logSeguridad: 0, logUsuarios: 0 }, function (err, result) {
				if (err) throw err;
				if (result == null) {
					res.sendStatus(404);
				} else {
					res.send(result);
				}
			});
		});
	});

	router.get('/giveDispTodosNuevos/:campoClaveDisp', function (req, res) {
		var auxCampoClaveDisp = req.params.campoClaveDisp;
		var query = { claveDisp: auxCampoClaveDisp };
		var filtro = {};
		db.collection("dispositivo").find(query, filtro).toArray(function (err, result) {
			if (err) throw err;
			if (result == null) {
				res.sendStatus(404);
			} else {
				res.send(result);
			}
		});
	});

	// POST /api/users gets urlencodedParser bodies
	router.post('/items2', urlencodedParser, function (req, res) {
		if (!req.body) return res.sendStatus(400)
		res.send('welcome, ' + req.body.usuario)
	});

	// 			Dos formas de devolver el _id al insertar
	//			res.send(result["ops"][0]["_id"]);
	//			res.send(myobj._id);
	//--------------------------------------------------------------------Ciclo Dispositivos-----------------
	//			INSERT POST /api/ gets JSON bodies
	router.post('/insertDispositivo', jsonParser, function (req, res) {
		//if (!req.body) return res.sendStatus(400)
		var myobj = req.body;
		var res;
		db.collection("dispositivo").insertOne(myobj, function (err, result) {
			if (err) throw err;
			console.log("1 dispositivo inserted");
		});
		res.sendStatus(200);
	});

	router.post('/actualizaDispositivoCasa', jsonParser, function (req, res) {
		//if (!req.body) return res.sendStatus(400)
		var myobj = req.body;
		var res;
		db.collection("casa").findOne({ homeUsu: myobj.casa }, { dispositivos: 1 }, function (err, result) {
			if (err) throw err;
			var dispositivos = result.dispositivos;
			for(var i = 0; i < dispositivos.length; i++){
				if(JSON.stringify(dispositivos[i]._id) == JSON.stringify(myobj._id)){
					delete dispositivos[i]['name'];
					delete dispositivos[i]['habitacion'];
					dispositivos[i]['name'] = myobj.name;
					dispositivos[i]['habitacion'] = myobj.habitacion;
				}
			}
			db.collection("casa").updateOne({ homeUsu: myobj.casa }, { $set:{dispositivos: dispositivos} }, function (err, result) {
				if (err) throw err;
				res.sendStatus(200);
				console.log("1 dispositivo actualizado");
			});
			
		});
	});

	router.post('/getLog', jsonParser, function (req, res) {
		//if (!req.body) return res.sendStatus(400)
		var myobj = req.body;
		var auxRes = [];
		db.collection("casa").findOne({ homeUsu: myobj.casa }, { dispositivos: 1 }, function (err, result) {
			if (err) throw err;
			for(var i = 0; i < result.dispositivos.length; i++){
				if(JSON.stringify(result.dispositivos[i]._id) == JSON.stringify(myobj._id)){
					for(var x = 0; x < result.dispositivos[i].log.length; x++){
						var auxJson = {};
						auxJson['fecha'] = result.dispositivos[i].log[x].fecha;
						auxJson['hora'] = result.dispositivos[i].log[x].hora;
						auxJson['suceso'] = result.dispositivos[i].log[x].suceso;
						auxRes.push(auxJson);
					}
				}
			}
			res.send(auxRes);
		});
	});

	// TODO: Falta la conexion con mqtt para activar y desactivar un led por ej	
	router.post('/interruptorDispositivoCasa', jsonParser, function (req, res) {
		var myobj = req.body;
		db.collection("casa").findOne({ homeUsu: myobj.casa }, function (err, resDisp) {
			var dispositivos = resDisp.dispositivos;
			for(var i = 0; i < dispositivos.length; i++){
				if(JSON.stringify(dispositivos[i]._id) == JSON.stringify(myobj._id)){
					var valorCarac = {};
					var activa = myobj.caracteristicas.activa;
					valorCarac['caracteristicas'] = {};
					valorCarac.caracteristicas['activa'] = activa;
					if(dispositivos[i].caracteristicas == null){
						dispositivos[i]['caracteristicas'] = {};
						dispositivos[i].caracteristicas['activa'] = activa;
					}else{
						dispositivos[i].caracteristicas.activa = activa;
					}
				}
			}
			db.collection("casa").updateOne({ homeUsu: myobj.casa }, {$set: {dispositivos: dispositivos}}, function (err, resDispUpdate) {
				console.log("interruptor dispositivo actualizado");
				/**Actualizamos estado interruptor*/
				var mensajeEnvio = constResponseInterruptor + '#' + myobj.casa + '#' + myobj._id + '#';
				client.publish(constResponseInterruptor, mensajeEnvio, { qos: 1, retain: false });   // Formato mensaje: respInterruptor#casa#idDisp#
				res.sendStatus(200);
			});
		});
	});


	router.post('/insertaDispositivoCasa', jsonParser, function (req, res) {
		var myId = req.body._id;
		var miCasa = req.body.casa;
		var miHabitacion = req.body.habitacion;
		var nomDisp = req.body.name;
		var query = { _id: new ObjectID(myId) };
		db.collection("casa").findOne({ "dispositivos._id": new ObjectID(myId) }, function (err, objComprueba) {
			if (err) throw err;
			if (objComprueba) {
				res.sendStatus(404);
			} else {
				db.collection("dispositivo").findOne(query, function (err, obj) {
					if (err) throw err;
					obj.casa = miCasa;
					obj.habitacion = miHabitacion;
					obj.name = nomDisp;
					var mac = obj.mac;
					var query = { homeUsu: miCasa };
					var newvalues = { $push: { dispositivos: obj } };
					db.collection("casa").updateOne(query, newvalues, function (err, objFin) {
						if (err) throw err;
						/** Actualizamos el log con la fecha del dispositivo añadido */
						logDisp.enviarLog(obj, constDispAñadido);	
						var query = { _id: new ObjectID(myId) };
						db.collection("dispositivo").deleteOne(query, function (err, objFin) {
							if (err) throw err;
							console.log("Eliminado de dispositivos y añadido a casa");
							db.collection("casa").findOne({homeUsu: miCasa}, {configuracion: 1}, function (err, objCasa) {
								/**Actualizamos estado alarma*/
								var auxTopic =  constConfAlarma + '/' + mac;
								if(objCasa.configuracion != null){
									client.publish(auxTopic, objCasa.configuracion.estadoAlarma, { qos: 1, retain: false });
								}
								/**Subscribimos al estado para actualizar */
								auxTopic = constEstado + '/' + mac;
								var auxDataInit = constEstado + '#' + mac + '#' + estadoInicialDisp + '#';
								client.subscribe(auxTopic);
								console.log('Subscrito a: ' + auxTopic);
								client.publish(auxTopic, auxDataInit, { qos: 1, retain: false });
								res.sendStatus(200);
							});
						});
					});
				});
			}
		});
	});

	// Delete elimina con condicion or ya se tenga el _id o el nombre
	router.delete('/eliminaDispositivo', jsonParser, function (req, res) {
		var miId = req.body._id;
		var casaDisp = req.body.casa;
		var myquery = { homeUsu: casaDisp };
		db.collection("casa").findOne(myquery, { dispositivos: 1 }, function (err, objCasa) {
			if (err) throw err;
			var auxDisp = objCasa.dispositivos;
			var auxDispArray = [];
			for (var i = 0; i < auxDisp.length; i++) {
				if (auxDisp[i]._id != miId) {
					auxDispArray.push(auxDisp[i]);
				}
			}
			db.collection("casa").updateOne(myquery, { $set: { dispositivos: auxDispArray } }, function (err, objCasa) {
				console.log("1 document deleted on home");
				console.log("Reseteando mC");
				client.publish(miId, constElimina, { qos: 1, retain: false });
				res.sendStatus(200);
			});
		});
	});

	//--------------------------------------------------------------------Ciclo Dispositivos-----------------
});


module.exports = router;
