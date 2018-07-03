var mongoUtil = require('../models/piMlabTestDatabase');
var objectId = require('mongodb').ObjectID;

function enviarLogDisp(dispositivo, suceso) {
	var auxJson = {};
	var fecha = fechaHoy();
	var hora = horaHoy();
	auxJson['fecha'] = fecha;
	auxJson['hora'] = hora;
	auxJson['suceso'] = suceso;
	var id = new objectId(dispositivo._id);
	mongoUtil.connectToServer(function (err) {
		var db = mongoUtil.getDb();
		db.collection("casa").findOne({ 'dispositivos._id': id }, { dispositivos: 1 }, function (err, res) {
			if (err) throw err;
			if (res != null) {
				for (var i = 0; i < res.dispositivos.length; i++) {
					if (JSON.stringify(res.dispositivos[i]._id) == JSON.stringify(id)) {
						res.dispositivos[i].log.unshift(auxJson);
					}
				}
				db.collection("casa").updateOne({ 'dispositivos._id': id }, { $set: { dispositivos: res.dispositivos } }, function (err, res) {
					console.log("Log insertado en disp casa");
				});
			}
		});
	});
}

function fechaHoy() {
	var hoy = new Date();
	var dd = hoy.getDate();
	var mm = hoy.getMonth() + 1; //hoy es 0!
	var yyyy = hoy.getFullYear();

	if (dd < 10) {
		dd = '0' + dd
	}

	if (mm < 10) {
		mm = '0' + mm
	}

	hoy = dd + '/' + mm + '/' + yyyy;
	return hoy;
}

function horaHoy() {
	var hoy = new Date();
	var hora = hoy.getHours();
	var m = hoy.getMinutes();
	var s = hoy.getSeconds();
	if (hora < 10) {
		hora = '0' + hora;
	}

	if (m < 10) {
		m = '0' + m;
	}

	if (s < 10) {
		s = '0' + s;
	}

	var res = hora + ":" + m + ":" + s;
	return res;
}

function comparaFechasLogDisp(dispositivo, mensaje) {
	var fechas = [];
	var auxId = new objectId(dispositivo._id);
	var hoy = new Date();
	hoy.setHours(0, 0, 0, 0);
	for (var i = 0; i < dispositivo.log.length; i++) {
		if (dispositivo.log[i].suceso == mensaje) {
			fechas.push(dispositivo.log[i].fecha);
		}
	}

	var diaLog, mesLog, añoLog;
	var fechaLog;
	var fechaLogMayor = new Date(1970, 0, 0);
	var inserta = false;
	for (var i = 0; i < fechas.length; i++) {
		var reciente = fechas[i].split("/");
		diaLog = parseInt(reciente[0]);
		mesLog = parseInt(reciente[1]);
		añoLog = parseInt(reciente[2]);
		fechaLog = new Date(añoLog, mesLog - 1, diaLog);
		if (fechaLogMayor < fechaLog) {
			fechaLogMayor = fechaLog;
		}
	}
	if (hoy > fechaLogMayor) {
		inserta = true;
	}

	if (inserta) {
		var aux = {};
		aux['_id'] = auxId;
		enviarLogDisp(aux, mensaje);
	}
}


module.exports.comparaFechasLogDisp = comparaFechasLogDisp;
module.exports.enviarLog = enviarLogDisp;
