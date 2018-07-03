var SchemaObject = require('node-schema-object');
 
// Create User schema 
var User = new SchemaObject({
  usuario: String,
  pass:String,
  admin:String,
  email:String
});
 
module.exports = User;


