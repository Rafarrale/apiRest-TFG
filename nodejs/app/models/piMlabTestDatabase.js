var MongoClient = require('mongodb').MongoClient;
var _db;
var url = "mongodb://usuariotfg:creative@ds135916.mlab.com:35916/tfg";

const options = {
  poolSize: 2,
  keepAlive: 300000,
  connectTimeoutMS: 30000,
  autoReconnect: true,
  reconnectTries: 300000,
  reconnectInterval: 5000,
  promiseLibrary: global.Promise
};

module.exports = {
  connectToServer: function (callback) {
    MongoClient.connect(url, options, function (err, db) {
      _db = db;
      return callback(err);
    });
  },

  getDb: function () {
    return _db;
  }
};

