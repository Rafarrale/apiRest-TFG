var mqtt = require('mqtt');
var mongoUtil = require('../models/piMlabTestDatabase');
var notificaciones = require('../routes/notificacion');
var ObjectID = require('mongodb').ObjectID;
var modules = require('../models/modules');

/**Variables sirena */
// TODO: descomentar para sirena
/*var Gpio = require('pigpio').Gpio,
        altavoz = new Gpio(18, {mode: Gpio.OUTPUT}),
        dutyCycle = 500000;
var intervalo;
*/

/* valores ESP */
var constElimina = "elimina";
var constNuevo = "nuevo";
var constAlarma = 'alarma';
var constConfAlarma = 'confAlarma';
var constConfInterruptor = 'confInterruptor';
var constResponseAlarma = 'respAlarma';
var constResponseInterruptor = 'respInterruptor';
var constBateriaBajaNum = 5;
var constBateriaBaja = 'Batería Baja';
var constBateria = 'bateria';
var constArmar = "armar";
var consDesarmar = "desarmar";
var constAbierto = "Abierto";
var consCasa = "casa";
var constEstado = 'estado';
var constIdRegistra = 'idRegistra';
var constEncripta = 'encripta';
var constConfirma = '200';
var constConfirmaDisp = '201';
var constI = 'I';
var constO = 'O';
var constCerrado = 'cerrado';
var auxTipo = null;


/* Las caracteristicas de tipos de cosntantes que pueden enir del esp */
var constEsp = [
    {
        tipo: constBateria, datos: '2' /* --> Si mandamos bateria#id#estadoBateria# = {otrosDatos(datos - 1), id(1), estadoBateria(0)} */
    },
    {
        tipo: constNuevo, datos: '3' /* --> Si mandamos nuevo#mac#tipo#claveDisp# = {otrosDatos(datos - 1), mac(2), tipo(1), claveDisp(0) */
    },
    {
        tipo: constAlarma, datos: '2' /* --> Si mandamos alarma#casa# = {otrosDatos(datos - 1), casa(1), activar(0)} */
    },
    {
        tipo: constResponseAlarma, datos: '1' /* --> Si mandamos respAlarma#casa# = {otrosDatos(datos - 1), casa(0)} */
    },
    {
        tipo: constResponseInterruptor, datos: '2' /* --> Si mandamos respInterruptor#casa#idDisp# = {otrosDatos(datos - 1), casa(1), idDisp(0)} */
    },
    {
        tipo: constEstado, datos: '2' /* --> Si mandamos estado#mac#tipoEstado# = {otrosDatos(datos - 1),mac(1), tipoEstado(0)} */
    },
    {
        tipo: constIdRegistra, datos: '2' /* --> Si mandamos idRegistra#esid#*macEsp# = {otrosDatos(datos - 1),esid(1), macEsp(0)} */
    },
    {
        tipo: constEncripta, datos: '2' /* --> Si mandamos encripta#datos#iv# = {otrosDatos(datos - 1),datos(1), iv(0)} */
    }
];

var connectOptions = {
    host: "192.168.2.20",
    port: 8883,
    protocol: "mqtts",
    keepalive: 10,
    clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
    protocolId: "MQTT",
    protocolVersion: 4,
    clean: false,
    reconnectPeriod: 2000,
    connectTimeout: 2000,
    username: 'usuario1',
    password: 'BeNq_42?',
    rejectUnauthorized: false,
};

module.exports = {
    connectToMQTT: mqtt.connect(connectOptions),
    subscribe: function (client, topic) {
        client.on('connect', function () {
            console.log('Topic subscrito: ' + topic);
            client.subscribe(topic, { qos: 2 });
        })
    },
    publish: function (client, topic, msg) {
        client.publish(topic, msg, { qos: 2, retain: false })
    },
    recibeId: function (client) {
        var res;
        client.on('message', function (topic, message, packet) {
            if (topic == constIdRegistra) {
                var mensaje = `${message.toString()}`;
                mongoUtil.connectToServer(function (err) {
                    var db = mongoUtil.getDb();
                    var datos = obtenEsp(mensaje);
                    var myId = datos[0][1];
                    var mac = datos[0][0];
                    var esValidoHex = isHex(myId);
                    if (esValidoHex) {
                        var query = { "dispositivos._id": new ObjectID(myId) };
                        var filtro = { dispositivos: 1, homeUsu: 1 };

                        db.collection("casa").findOne(query, filtro, function (err, result) {
                            if (err) throw err;
                            if (result != null) {
                                console.log("Se encuentra en Casa");
                                var res = constConfirma + '#' + result.homeUsu;
                                client.publish(myId, res, { qos: 2, retain: false });
                                /** Subscribimos el topic si ya se encuentra en casa para ponerlo en estado online u offline
                                 * solo si ya se encuentra en una casa
                                 */
                                var auxTopic = constEstado + '/' + mac;
                                client.subscribe(auxTopic, { qos: 2 });
                                console.log('Subscrito a: ' + auxTopic);
                            } else {
                                db.collection("dispositivo").findOne({ _id: new ObjectID(myId) }, function (err, obj) {
                                    if (err) throw err;
                                    if (obj != null) {
                                        client.publish(myId, constConfirmaDisp, { qos: 2, retain: false });
                                    } else {
                                        console.log("Reseteando mC");
                                        client.publish(myId, constElimina, { qos: 2, retain: false });
                                    }
                                });
                            }
                        });
                    } else {
                        var datos = obtenEsp(mensaje);
                        var mac = datos[0][2];
                        var tipo = datos[0][1];
                        var auxClaveDisp = datos[0][0];
                        var myobj =
                        {
                            casa: null,
                            habitacion: null,
                            name: null,
                            estado: null,
                            tipo: tipo,
                            mac: mac,
                            bateria: null,
                            claveDisp: auxClaveDisp,
                            log: []
                        };
                        db.collection("dispositivo").insertOne(myobj, function (err, result) {
                            if (err) throw err;
                            console.log("1 dispositivo insertado");
                            res = JSON.stringify(result.insertedId);
                            res = res.replace(/['"]+/g, '');
                            client.publish(mac, res, { qos: 2, retain: false });
                        });
                    }
                });
            }
        });

    },
    // Si mandamos alarma#idDisp#activar# = {otrosDatos(datos - 1), idDisp(1), activar(0)} */
    recibeAlarmas: function (client) {
        client.on('message', function (topic, message, packet) {
            if (topic == constAlarma) {
                var mensaje = `${message.toString()}`;
                mongoUtil.connectToServer(function (err) {
                    var db = mongoUtil.getDb();
                    var datos = obtenEsp(mensaje);
                    var activar = datos[0][0];
                    var idDisp = datos[0][1];
                    var auxId = new ObjectID(idDisp);
                    db.collection("casa").findOne({ 'dispositivos._id': auxId }, { tokens: 1, dispositivos: 1 }, function (err, result) {
                        if (err) throw err;
                        if (result != null) {
                            var dispositivo = {};
                            dispositivo['_id'] = idDisp;
                            if (activar == constI) {
                                console.log('Activa Sirena');
                                sonarSirena(activar);
                                /** Envio del Log */
                                modules.enviarLog(dispositivo, constAbierto);
                                /** Envio de la notificacion */
                                var i = 0;
                                var habitacion;
                                var name;
                                var casa;
                                var dispositivos = result.dispositivos;
                                for (i = 0; i < dispositivos.length; i++) {
                                    var dispositivo = dispositivos[i];
                                    if (JSON.stringify(dispositivo._id) == JSON.stringify(auxId)) {
                                        habitacion = dispositivo.habitacion;
                                        name = dispositivo.name;
                                        casa = dispositivo.casa;
                                    }
                                }
                                var mensaje = "Sensor " + name + " de la Habitación " + habitacion;
                                for (i = 0; i < result.tokens.length; i++) {
                                    notificaciones.func(result.tokens[i].token, mensaje, casa);
                                }
                            } else if (activar == constO) {
                                console.log('Desactiva Sirena');
                                sonarSirena(activar);
                            } else if (activar == constCerrado) {
                                /** Envio del Log */
                                var aux = Object.assign(constCerrado);
                                aux = aux.charAt(0).toUpperCase() + aux.slice(1);
                                modules.enviarLog(dispositivo, aux);
                            }
                        }
                    });
                });
            }
        });
    },
    configuraDispositivos: function (client) {
        client.on('message', function (topic, message, packet) {
            if (topic == constConfAlarma) {
                var mensaje = `${message.toString()}`;
                if (mensaje == constArmar) {
                    console.log('Armar');
                } else if (mensaje == consDesarmar) {
                    console.log('Desarmar');
                } else if (mensaje == consCasa) {
                    console.log('Casa');
                } else {
                    console.log('Alarma');
                }

            }
        });
    },
    responseEstadoDispositivos: function (client) {
        client.on('message', function (topic, message, packet) {
            if (topic == constResponseAlarma) {
                var mensaje = `${message.toString()}`;
                mongoUtil.connectToServer(function (err) {
                    var db = mongoUtil.getDb();
                    var datos = obtenEsp(mensaje); // respAlarma#casa#
                    var casa = datos[0][0];
                    db.collection("casa").findOne({ homeUsu: casa }, { 'configuracion.estadoAlarma': 1, dispositivos: 1 }, function (err, result) {
                        if (result != null) {
                            var auxEstadoAlarma = result.configuracion.estadoAlarma;
                            for (var i = 0; i < result.dispositivos.length; i++) {
                                var topic = constConfAlarma + '/' + result.dispositivos[i].mac;
                                if (auxEstadoAlarma == constArmar) {
                                    console.log('Armar');
                                    // Mandamos el estado de la alarma a los dispositivos
                                    client.publish(topic, auxEstadoAlarma, { qos: 2, retain: false });
                                } else if (auxEstadoAlarma == consDesarmar) {
                                    console.log('Desarmar');
                                    // Mandamos el estado de la alarma a los dispositivos
                                    client.publish(topic, auxEstadoAlarma, { qos: 2, retain: false });
                                } else if (auxEstadoAlarma == consCasa) {
                                    console.log('Casa');
                                    // Mandamos el estado de la alarma a los dispositivos
                                    client.publish(topic, auxEstadoAlarma, { qos: 2, retain: false });
                                } else {
                                    console.log('Alarma');
                                    // Mandamos el estado de la alarma a los dispositivos
                                    client.publish(topic, auxEstadoAlarma, { qos: 2, retain: false });
                                }
                            }
                        }
                    });
                });
            }
        });
    },
    responseEstadoInterruptor: function (client) {
        client.on('message', function (topic, message, packet) {
            if (topic == constResponseInterruptor) {
                var mensaje = `${message.toString()}`;
                mongoUtil.connectToServer(function (err) {
                    var db = mongoUtil.getDb();
                    var datos = obtenEsp(mensaje); // respInterruptor#casa#idDisp#
                    var casa = datos[0][1];
                    var idDisp = datos[0][0];
                    db.collection("casa").findOne({ homeUsu: casa }, { dispositivos: 1 }, function (err, result) {
                        if (result != null) {
                            for (var i = 0; i < result.dispositivos.length; i++) {
                                if (JSON.stringify(result.dispositivos[i]._id) == JSON.stringify(new ObjectID(idDisp))) {
                                    var topic = constConfInterruptor + '/' + result.dispositivos[i].mac;
                                    if(result.dispositivos[i].caracteristicas != null){
                                        if (result.dispositivos[i].caracteristicas.activa) {
                                            console.log('activar');
                                            // Mandamos el estado del interruptor al dispositivo
                                            client.publish(topic, 'true', { qos: 2, retain: false });
                                        }else{
                                            console.log('desactivar');
                                            client.publish(topic, 'false', { qos: 2, retain: false });
                                        }
                                    }
                                }
                            }
                        }
                    });
                });
            }
        });
    },
    // Si mandamos estado#mac#tipoEstado# = {otrosDatos(datos - 1),mac(1), tipoEstado(0)} */
    recibeEstadoSensor: function (client) {
        client.on('message', function (topic, message, packet) {
            if (compruebaTopic(topic)) {
                var mensaje = `${message.toString()}`;
                var datos = obtenEsp(mensaje);
                var mac = datos[0][1];
                var tipoEstado = datos[0][0];
                if (topic == constEstado + '/' + mac) {
                    mongoUtil.connectToServer(function (err) {
                        var db = mongoUtil.getDb();
                        db.collection('casa').findOne({ 'dispositivos.mac': mac }, function (err, resultDispCasa) {
                            var dispositivo;
                            if (resultDispCasa != null) {
                                var dispositivos = resultDispCasa.dispositivos;
                                for (var i = 0; i < dispositivos.length; i++) {
                                    if (dispositivos[i].mac == mac) {
                                        dispositivos[i].estado = tipoEstado;
                                        dispositivo = dispositivos[i];
                                    }
                                }
                                db.collection('casa').updateOne({ 'dispositivos.mac': mac }, { $set: { dispositivos: dispositivos } }, function (err, resultDispCasa) {
                                    console.log('estado dispositivo casa actualizado');
                                    if (dispositivo != null) {
                                        tipoEstado = tipoEstado.charAt(0).toUpperCase() + tipoEstado.slice(1);
                                        modules.enviarLog(dispositivo, tipoEstado);
                                    }
                                });
                            }
                        });
                    });
                }
            }
        });
    },
    recibeEstadoBateria: function (client) {
        client.on('message', function (topic, message, packet) {
            if (topic == constBateria) {
                mongoUtil.connectToServer(function (err) {
                    var db = mongoUtil.getDb();
                    var mensaje = `${message.toString()}`;
                    if (topic == constBateria) {
                        var datos = obtenEsp(mensaje);
                        var auxId = datos[0][1];
                        var auxbat = datos[0][0];
                        var idObject = new ObjectID(auxId);
                        db.collection('dispositivo').findOne({ _id: idObject }, { _id: 1 }, function (err, result) {
                            if (err) throw err;
                            if (result != null) {
                                db.collection('dispositivo').updateOne({ _id: idObject }, { $set: { bateria: auxbat } }, function (err, res) {
                                    if (err) throw err;
                                    if (res != null) {
                                    }
                                })
                            } else {
                                db.collection('casa').findOne({ 'dispositivos._id': idObject }, { dispositivos: 1 }, function (err, result) {
                                    if (err) throw err;
                                    if (result != null) {
                                        var dispositivo;
                                        var jsonArray = [];
                                        for (var x = 0; x < result.dispositivos.length; x++) {
                                            var disp = result.dispositivos[x];
                                            if (JSON.stringify(disp._id) === JSON.stringify(idObject)) {
                                                dispositivo = disp;
                                                if (disp.bateria != auxbat) {
                                                    result.dispositivos[x].bateria = auxbat;
                                                    jsonArray.push(result.dispositivos[x]);
                                                } else {
                                                    jsonArray.push(result.dispositivos[x]);
                                                }
                                            } else {
                                                jsonArray.push(result.dispositivos[x]);
                                            }
                                        }

                                        db.collection('casa').updateOne({ 'dispositivos._id': idObject }, { $set: { dispositivos: jsonArray } }, function (err, res) {
                                            if (err) throw err;
                                            if (res != null) {
                                                if (auxbat == constBateriaBajaNum && dispositivo != null) {

                                                    modules.comparaFechasLogDisp(dispositivo, constBateriaBaja);
                                                }
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    }
                });
            }
        })

    }
}

function sonarSirena(activar) {
    if (activar == constI) {
        console.log('sonando');
        /* TODO: descomentar para sirena
        if(intervalo == null){
			activarSirena();
        }
        */
    } else if (activar == constO) {
        console.log('desactivando sonoro');
        /* TODO: descomentar para sirena
        desactivarSirena();
        intervalo = null;
        altavoz.hardwarePwmWrite(0, 0);
        */
    }
}

function activarSirena() {
    frec = 0;
    aux = 0;
    toneVal = 0;

    intervalo = setInterval(function () {
        aux = Math.sin(frec * (3.1412 / 180));
        toneVal = 2000 + (Math.round(aux * 1000));
        altavoz.hardwarePwmWrite(toneVal, dutyCycle);
        //console.log(toneVal);
        frec += 1;
        if (frec > 180) {
            frec = 0;
        }
    }
        , 20);
}

function desactivarSirena() {
    clearInterval(intervalo);
}

function compruebaTopic(topic) {
    var auxTopic = '';
    var res = false;
    for (var i = 0; i < topic.length; i++) {
        auxTopic += topic[i];
        if (topic[i + 1] == '/') {
            break;
        }
    }
    if (auxTopic == constEstado) {
        res = true;
    }
    return res;
}
/* --> Si mandamos bateria#id#estadoBateria# = {otros(datos - 1), id(1), estado bateria(0)} */
function obtenEsp(mensaje) {
    var arrayRes = [];
    var auxTipo = '';
    var auxVal = '';
    var auxValArray = {};
    var datos = 0;
    var i = 0;
    var sal = false;
    if (mensaje.length <= 300) {
        for (i = 0; mensaje[i] != '#' && i < mensaje.length; i++) {
            if (compruebaAlfanumerico(mensaje[i])) {
                auxTipo += mensaje[i];
            } else {
                sal = true;
                break;
            }
        }
        if (!sal || validaTipo(auxTipo)) {
            i++;
            for (var x = 0; x < constEsp.length; x++) {
                if (constEsp[x].tipo == auxTipo) {
                    datos = constEsp[x].datos;
                }
            }
            if (datos != 0) {
                for (; i < mensaje.length; i++) {
                    if (mensaje[i] != '#') {
                        auxVal += mensaje[i];
                    } else {
                        auxValArray[datos - 1] = (auxVal);
                        datos--;
                        auxVal = '';
                    }
                }
            }
        }
    }
    arrayRes.push(auxValArray);
    return arrayRes;
}

function compruebaAlfanumerico(TCode) {
    var res = true;
    if (/[^a-zA-Z0-9#/]/.test(TCode)) {
        res = false;
    }
    return res;
}

function isHex(h) {
    var res = false;
    var numCarac = 24;
    var aux = 0;
    for (var i = 0; i < h.length; i++) {
        if (/[a-z]/.test(h.charAt(i))) {
            aux = aux + 1;
        } else if (/[0-9]/.test(h.charAt(i))) {
            aux = aux + 1;
        }
    }
    if (aux == numCarac) {
        res = true;
    }
    return res;
}

function validaTipo(tipo) {
    var res = false;
    for (var i = 0; i < constEsp.length; i++) {
        if (constEsp[i].tipo == tipo) {
            res = true;
            break;
        }
    }
    return res;
}
