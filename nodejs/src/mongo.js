
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
var nodes = [];

//Publsher Code
setInterval(function () {
  amqp.connect('amqp://user:bitnami@192.168.56.108', function (error0, connection) {
    console.log("Sending the alive message. Host Name:" + myhostname + " The Node ID:" + nodeID);
    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }

      var exchange = 'logs';
      var msg = { "hostname": myhostname, "status": "alive", "nodeID": nodeID };

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
amqp.connect('amqp://user:bitnami@192.168.56.108', function (error0, connection) {
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

      channel.consume(q.queue, function (msg) {
        if (msg.content) {
          console.log('Message Content: ' + msg.content.toString());
          var message = JSON.parse(msg.content.toString());

          var node_exists = false;
          var indexOfNodeExists = 0;

          // Check the nodes in the array to see if they exist
          Object.entries(nodes).forEach((hostname, props) => {
            console.log('Node ' + indexOfNodeExists + 'message hostname:' + message.hostname);
            console.log('Node ' + indexOfNodeExists + 'message hostname:' + message.Date);

            //Increase the index counter only when the node hasn't been found
            if (node_exists == false) {
              indexOfNodeExists++;
            }
            //If the node does exist switch the flag
            if (hostname == message.hostname) {
              node_exists = true;
            }
          })

          //Getting date and time from right now
          let date = new Date()
          var dateNow = date.toISOString();
          console.log('The newDate is now: ' + dateNow);

          if (node_exists) {
          //Change the existing entry in the nodes list with the nodeID and with the updated date.
            nodes[myhostname] = { "nodeID": nodeID, "Date": dateNow };
          } else {
            //Push the node to the nodes array
            nodes[indexOfNodeExists] = { "nodeID": nodeID, "Date": dateNow };
          }

      //When published, the subscriber will print out what has been published
          console.log(" [x] %s", msg.content.toString());
        }
        else {
          //If there is no content, then log to the console that no message was received.
          console.log('No Message')
        }
      }, {
        noAck: true
      });
    });
  });
});
