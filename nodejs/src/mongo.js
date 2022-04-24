
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


//leadership election
let systemLeader = 0;

//Used to see if the system scaled up yet
var scaledUpYet = false;

//Used to store the host Names of node 4 and node 5
var node4HostName = null
var node5HostName = null
//instance of express and port to use for inbound connections.
const app = express()
const port = 3000

//import the request library
var request = require('request');

//This is the URL endpoint of the vm for the docker API calls
var url = 'http://192.168.56.112:2375';

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
            var foundNode = nodes.find(foundNodeObject => foundNodeObject.hostName === messageReceived.hostName);
            foundNode.date = timeSentReceived;
            if (foundNode.nodeID !== messageReceived.nodeID) {
              foundNode.nodeID = messageReceived.nodeID;
            }
          } else {
            nodes.push(messageReceived);
          }
          //Has sent the first message so change the flag
          firstMessageSentSuccessfully = true;
        } else {
          //If there is no content, then log to the console that no message was received.
          console.log('No Message')
        }
        console.log("--------- Each node RESTART Start ----------")
        Object.entries(nodes).forEach(([hostname, prop]) => {
          console.log('hostname: ' + prop.hostName + ' prop nodeID : ' + prop.nodeID + ' prop status : ' + prop.status + ' prop date : ' + prop.date)
        });
        console.log("--------- Each node RESTART End ----------")
      }, {
        noAck: true
      });
    });
  });
});

setInterval(function () {
  var maxID = 0;
  // Nodes were saying they were the leader before even communicating to each other. 
  // So when first message with content has been received (RabbitMQ has done its job!) then elect a leader
  if (firstMessageSentSuccessfully) {
    Object.entries(nodes).forEach(([hostname, prop]) => {
    if (prop.hostName != myhostname) {
        if (prop.nodeID > maxID) {
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


//create the post object to send to the docker api to create a container
var create = {
  uri: url + "/v1.40/containers/create",
  method: 'POST',
  //deploy an alpine container that prints out that it has been created
  json: { "Image": "alpine", "Cmd": ["echo", "Docker API have now created a new container!"] }
};

//Check to see if any node has died Section
setInterval(function () {
  var deadNode = null;
  //Check to see if any node...
  Object.entries(nodes).forEach(([hostName, individualNode]) => {
    //...hasn't sent a message in 10 or more seconds
    var alive = (timeSentReceived - individualNode.date) < 9 ? true : false;
    if (alive) {
      // individualNode.status = "Alive";
      //If so, don't do anything and output that the node is still alive
      console.log("Node " + individualNode.hostName + " is alive.");
    }
    else {
      //Not alive so it means it is dead and therefore, remove from the nodes array. 
      nodes.splice(hostName, 1);
      //And set is there a dead node to true
      deadNode = individualNode;
      //Output a message to the console that that node is dead.
      console.log(deadNode.hostName + " is dead and has been removed from the nodes array.");
    }

    if (systemLeader == 1 && deadNode != null) {
      //Don't call this if statement until the dead node has been created by making deadNode to null.
      deadNode = null;

      //The full container name is called '6012dacomp-coursework_HOSTNAME_1' (you can see the name when you do `docker_compose up`)
      var fullHostName = '6012dacomp-coursework_' + individualNode.hostName + '_1';
    console.log('Need to restart container. Took more than 10 seconds');
    
    //send the create request
      request(create, function (error, response) {
        if (!error) {
          //Has done all the sections in the nested calls.
          console.log("Created container " + JSON.stringify(individualNode));

          //post object for the container start request
          var start = {
            uri: url + "/v1.40/containers/" + fullHostName + "/start",
            method: 'POST',
            json: {}
          };

          //send the start request
          request(start, function (error, response) {
            if (!error) {
              console.log("Container start completed");
              //post object for wait. Wait until the container has been created
              var wait = {
                uri: url + "/v1.40/containers/" + fullHostName + "/wait",
                method: 'POST',
                json: {}
              };
              request(wait, function (error, response, waitBody) {
                if (!error) {
                  console.log("run wait complete, container will have started");
                  //send a simple get request for stdout from the container
                  request.get({
                    url: url + "/v1.40/containers/" + fullHostName + "/logs?stdout=1",
                  }, (err, res, data) => {
                    if (err) {
                      console.log('Error:', err);
                    }
                    else if (res.statusCode !== 200) {
                      console.log('Status:', res.statusCode);
                    } else {
                      //we need to parse the json response to access
                      console.log("Container stdout = " + data);
                    }
                  });
                }
              });
            }
          });
        }
      });
  }
  });
}, 10000);

// Peak Hours section
setInterval(function () {
  //If it is the system leader then do this piece of code.
  if (systemLeader == 1) {
    //Get the current hour of now.
    var currentHour = new Date().getHours();
    //The 3 current containers have 1-100. The two new containers will have an ID between 101-1000 so they don't have clash with the others
    let range = { min: 101, max: 1000 };
    let delta = range.max - range.min;
    node4HostName = Math.round(range.min + Math.random() * delta);
    node5HostName = Math.round(range.min + Math.random() * delta);

    console.log("Node4HostName:" + node4HostName);
    console.log("Node5HostName:" + node5HostName);

    //scaledUpYet prevents this code from being executed twice and spinning up more than 2 containers
    //If Current Hour is between 16:00 and 18:00
    if (!scaledUpYet && currentHour > 16 && currentHour < 18) {
      console.log("Peak hours has started. 2 New containers are being created and started");

      //Scale up (code comes here Ashley)

      //Has now been scaled up so set flag to true
      scaledUpYet = true;
    }
    //If Current Hour is not between 16:00 and 18:00 and hasn't been scaled up yet.
    if (!scaledUpYet && currentHour < 16 && currentHour > 18) {
      if (node4HostName != null && node5HostName != null) {
        console.log("Peak hours has ended. Killing the new containers we spun up before");
        //Kill and remove the containers that have the hostname stored in node4HostName and node5HostName
        //Scale down(code comes here Ashley)

        //Set scaled up yet flag to false, as it has now been scaled down 
        scaledUpYet = false;
      } else {
        //Got into the wrong state (should never happen but has been put in for debugging proposes)
        console.log("Node4 and Node5 haven't been set and therefore cannot be scaled down.")
      }
    }
  }
}, 5000);