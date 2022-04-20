
//Object data modelling library for mongo
const mongoose = require('mongoose');

//Mongo db client library
//const MongoClient  = require('mongodb');

//Express web service library
const express = require('express')

//used to parse the server response from json to object.
const bodyParser = require('body-parser');

//Get the hostname of the node
const os = require("os");
var myhostname = os.hostname();
//Required for RabbitMQ Messaging Queue service
var amqp = require('amqplib/callback_api');

//Holds the nodes for each host
var nodes = [];

//instance of express and port to use for inbound connections.
const app = express()
const port = 3000

const axios = require("axios");

//connection string listing the mongo servers. This is an alternative to using a load balancer. THIS SHOULD BE DISCUSSED IN YOUR ASSIGNMENT.
const connectionString = 'mongodb://localmongo1:27017,localmongo2:27017,localmongo3:27017/notFlixDB?replicaSet=rs0';

setInterval(function() {
  console.log(`Mongo JS code now executing`);
}, 3000);

//tell express to use the body parser. Note - This function was built into express but then moved to a seperate package.
app.use(bodyParser.json());

//connect to the cluster
mongoose.connect(connectionString, {useNewUrlParser: true, useUnifiedTopology: true});


var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var Schema = mongoose.Schema;

//Structure of the assignment schema
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

//Deal with the get request by sending back all of the information
app.get('/', (req, res) => {
  notFlixModel.find({}, '_id accountID userName titleID userAction dateAndTime pointOfInteraction typeOfInteraction', (err, interactions) => {
    if(err) return handleError(err);
    res.send(JSON.stringify(interactions))
  }) 
})

// Deal with sending the data into the DB
app.post('/',  (req, res) => { 
  var new_notFlix_instance = new notFlixModel(req.body); 
  new_notFlix_instance.save(function (err) { 
  if (err) res.send('Error'); 
    res.send(JSON.stringify(req.body)) 
  }); 
})

//bind the express web service to the port specified
app.listen(port, () => {
 console.log(`Express Application listening at port ` + port)
})
//Declare status of node, and say for the moment, that it is alive
var status = "Alive";

// Declare a variable to hold when a message from the node was last sent/received
var timeSentReceived = new Date().getTime() / 1000;

// Randomly generate a number for the node id
var nodeID = Math.floor(Math.random() * (100 - 1 + 1) + 1);

// The message, containing the hostname of the node, the status of the node, the nodeID of the node 
//and the date of last message, that will be stored in the nodes array.
var nodeMessage = { hostName: myhostname, status: status, nodeID: nodeID, date: timeSentReceived };
//Put this message into the nodes array
nodes.push(nodeMessage);

//Flag to see whether the first message has been sent (used for the election - had problems - see the section for more details)
var firstMessageSentSuccessfully = false;

//Publisher Code
setInterval(function () {
  amqp.connect('amqp://user:bitnami@192.168.56.112', function (error0, connection) {
    console.log("Sending the alive message. Host Name:" + myhostname + " The Node ID:" + nodeID);
    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }

      //Getting date and time for right now
      timeSentReceived = new Date().getTime() / 1000;
      var exchange = 'logs';
      //Sends the host name, the status that is alive, the nodeID and the current date to the subscribers.
      var msg = `{"hostName": "${myhostname}", "status":"${status}", "nodeID": ${nodeID}, "date": ${timeSentReceived}}`
      channel.assertExchange(exchange, 'fanout', {
        durable: false
      });
      channel.publish(exchange, '', Buffer.from(JSON.stringify(JSON.parse(msg))));
      console.log(" [x] Sent %s", msg);
    });


    setTimeout(function () {
      connection.close();
    }, 500);
  });
}, 2000);


//Subscriber Code
amqp.connect('amqp://user:bitnami@192.168.56.112', function (error0, connection) {
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
         //When published, the subscriber will print out what has been published
          console.log('Subscriber received: ' + msg.content.toString());
          //Update the timeSentReceived variable to the time now (it has received the message so update variable)
          timeSentReceived = new Date().getTime() / 1000;

          //Put the received message in a variable and parse it.
          var messageReceived = JSON.parse(msg.content.toString());

          //Add/Replace information to the node (if already exists then replace, if not exist add to array)
          if (nodes.some(node => node.hostName === messageReceived.hostName)) {
            var foundNode = nodes.find(foundNodeObject => foundNodeObject.hostName === messageReceived.hostName).date = timeSentReceived;
            if (foundNode.nodeID === messageReceived.nodeID) {
              
              nodes.push(messageReceived);
            }
          } else {
            foundNode.nodeID = messageReceived.nodeID;
            
          }
          //Has sent the first message so change the flag
          firstMessageSentSuccessfully = true;
        } else {
          //If there is no content, then log to the console that no message was received.
          console.log('No Message')
        }
      }, {
        noAck: true
      });
    });
  });
});

//leadership election
let systemLeader = 0;

setInterval(function () {
  var maxID = 0;
  console.log('attempting to do leadership code 0');
  // Nodes were saying they were the leader before even communicating to each other. 
  // So when first message with content has been received (RabbitMQ has done its job!) then elect a leader
  if (firstMessageSentSuccessfully) {
  console.log('attempting to do leadership code 1');
  Object.entries(nodes).forEach(([hostname, prop]) => {
      console.log('attempting to do leadership code 2');
      if (prop.hostName != myhostname) {
        console.log('attempting to do leadership code 3');
        if (prop.nodeID > maxID) {
          console.log('attempting to do leadership code 4');
          maxID = prop.nodeID;
        }
      }
    });
  }
  //If the curent node is equal to higher than the max ID, then it is the leader!
  if (nodeID >= maxID) {
    systemLeader = 1;
    console.log('I, ' + myhostname + ', am the leader');
  }
}, 2000);

// setInterval(function () {
//   if (systemLeader == 1) {
//     console.log('I am the leader');

//     // Get time now and also the epoch time
//     let dateNow = new Date;
//     let dateNowEpoch = new Date().getTime() / 1000;
//     console.log("--------- Each node Start ----------")

//     Object.entries(nodes).forEach(([hostname, prop]) => {
//       console.log("testinggggg" + JSON.stringify(hostName) + JSON.stringify(prop))
//       console.log('hostname: ' + prop.hostName + ' prop nodeID : ' + prop.nodeID + ' prop status : ' + prop.status + ' prop date : ' + prop.date)

//       // Get the difference between the time message was sent and the time now.
//       let currentNodeDateConverted = new Date(prop.date).getTime() / 1000;
//       let timeBetweenNodeMessage = dateNowEpoch - currentNodeDateConverted;

//       console.log('timeBetweenNodeMessage: ' + timeBetweenNodeMessage);
//       //If message hasn't been received for 20 seconds
//       if (timeBetweenNodeMessage < 20) {
//         console.log('No need to restart container. Sending it in the correct time');
//       } else {
//         // Will go to function to restart container
//         console.log('Need to restart container. Took more than 20 seconds');
//         restartContainer(prop);
//       }
//     });
//     console.log("--------- Each node End ----------")


//     // TODO Ash: Come back to later
//     if (dateNow.getHours() >= 16 && dateNow.getHours() <= 18) {
//       //Scale up
//     } else if (dateNow.getHours() >= 18) {
//       //Scale down
//     }
//   }
// }, 5000)

// async function restartContainer(propToRestart) {
//   let hostNameToRestart = propToRestart.hostname
//   if (leader == 1 && propToRestart.status != "Restarting") {
//     console.log("Restarting container");
//     try {
//       console.log("Stopping container: " + hostNameToRestart);
//       console.log("Stopping container (ssss): " + propToRestart.hostname);
//       //Stops the container due to the message not being delivered within 20 seconds
//       await axios.post(`http://host.docker.internal:2375/containers/${hostNameToRestart}/stop`).then(function (response) { console.log(response) });
//       console.log("Starting container: " + propToRestart.hostname);
//       // await axios.post(`http://host.docker.internal:2375/containers/create?name= ${myhostname}`, containerDetails).then(function (response) { console.log(response) });
//       // Starts the container back up again
//       await axios.post(`http://host.docker.internal:2375/containers/${hostNameToRestart}/start`).then(function (response) { console.log(response) });;

//       nodes.some(node => node.hostName === hostNameToRestart) ?
//         (nodes.find(e => e.hostName === hostNameToRestart)).status
//         = "Restarting"
//         : console.log('ERRORR ASHLEY TO DO WITH RESTART NODE ARRAY (here on/around line 319')

//       console.log('Replaced entry in nodes array to say we are restarting the container');


//       console.log("--------- Each node RESTART Start ----------")
//       Object.entries(nodes).forEach(([hostname, prop]) => {
//         console.log('hostname: ' + prop.hostName + ' prop nodeID : ' + prop.nodeID + ' prop status : ' + prop.status + ' prop date : ' + prop.date)
//       });
//       console.log("--------- Each node RESTART End ----------")

//     }
//     catch (error) {
//       console.log(error);
//     }
//   }
// }