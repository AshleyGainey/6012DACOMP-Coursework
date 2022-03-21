
//Object data modelling library for mongo
const mongoose = require('mongoose');

//Mongo db client library
//const MongoClient  = require('mongodb');

//Express web service library
const express = require('express')

//used to parse the server response from json to object.
const bodyParser = require('body-parser');

const os = require("os");
var myhostname = os.hostname();

var amqp = require('amqplib/callback_api');

//instance of express and port to use for inbound connections.
const app = express()
const port = 3000

//connection string listing the mongo servers. This is an alternative to using a load balancer. THIS SHOULD BE DISCUSSED IN YOUR ASSIGNMENT.
const connectionString = 'mongodb://localmongo1:27017,localmongo2:27017,localmongo3:27017/notFlixDB?replicaSet=rs0';

setInterval(function() {

  console.log(`Intervals are used to fire a function for the lifetime of an application.`);

}, 3000);

//tell express to use the body parser. Note - This function was built into express but then moved to a seperate package.
app.use(bodyParser.json());

//connect to the cluster
mongoose.connect(connectionString, {useNewUrlParser: true, useUnifiedTopology: true});


var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var Schema = mongoose.Schema;

var notFlixSchema = new Schema({
  _id : Number,
  accountID: Number,
  userName: String,
  titleID: Number,
  userAction: String,
  dateAndTime: Date,
  pointOfInteraction: String,
  typeOfInteraction: String
});

var notFlixModel = mongoose.model('Interactions', notFlixSchema, 'interactions');

app.get('/', (req, res) => {
  notFlixModel.find({},'_id accountID userName titleID userAction dateAndTime pointOfInteraction typeOfInteraction lastName', (err, interactions) => {
    if(err) return handleError(err);
    res.send(JSON.stringify(interactions))
  }) 
})

app.post('/',  (req, res) => { 
  var new_notFlix_instance = new notFlixModel(req.body); 
  new_notFlix_instance.save(function (err) { 
  if (err) res.send('Error'); 
    res.send(JSON.stringify(req.body)) 
  }); 
}) 

app.put('/',  (req, res) => {
  res.send('Got a PUT request at /')
})

app.delete('/',  (req, res) => {
  res.send('Got a DELETE request at /')
})

//bind the express web service to the port specified
app.listen(port, () => {
 console.log(`Express Application listening at port ` + port)
})

var nodeID = Math.floor(Math.random() * (100 - 1 + 1) + 1);
toSend = { "hostname": myhostname, "status": "alive", "nodeID": nodeID };
setInterval(function () {
  //Publsher Code
  amqp.connect('amqp://test:test@192.168.56.108', function (error0, connection) {
    console.log("Sending the alive message. Host Name:" + myhostname + " The Node ID:" + nodeID);

    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }



      var exchange = 'logs';
      var msg = toSend;

      channel.assertExchange(exchange, 'fanout', {
        durable: false
      });
      channel.publish(exchange, '', Buffer.from(msg.toString()));
      console.log(" [x] Sent %s", msg);
    });


    setTimeout(function () {
      connection.close();
    }, 500);
  });
}, 2000);

//Subscriber Code
amqp.connect('amqp://test:test@192.168.56.108', function (error0, connection) {
  console.log("In Subscriber part, awaiting for messages.");
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }
    var exchange = 'logs';

    channel.assertExchange(exchange, 'fanout', {
      durable: false
    });

    channel.assertQueue('', {
      exclusive: true
    }, function (error2, q) {
      if (error2) {
        throw error2;
      }
      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
      channel.bindQueue(q.queue, exchange, '');

      //When published, this will print out what has been published
      channel.consume(q.queue, function (msg) {
        if (msg.content) {
          console.log(" [x] %s", msg.content.toString());
        }
      }, {
        noAck: true
      });
    });
  });
});
