
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

// Randomly generate a number for the node id
var nodeID = Math.floor(Math.random() * (100 - 1 + 1) + 1);

//Publisher Code
setInterval(function () {
  amqp.connect('amqp://user:bitnami@192.168.56.108', function (error0, connection) {
    // console.log("Sending the alive message. Host Name:" + myhostname + " The Node ID:" + nodeID);
    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }

      //Getting date and time from right now
      let date = new Date()
      var dateNow = date.toISOString();

      var exchange = 'logs';
      //Sends the host name, the status that is alive, the nodeID and the current date to the subscribers.
      var msg = { "hostName": myhostname, "status": "alive", "nodeID": nodeID, "date": dateNow };

      channel.assertExchange(exchange, 'fanout', {
        durable: false
      });
      channel.publish(exchange, '', Buffer.from(JSON.stringify(msg)));
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
         //When published, the subscriber will print out what has been published
          console.log('Subscriber received: ' + msg.content.toString());
          var message = JSON.parse(msg.content);

          //Replace the entry or add an entry in the nodes list with the nodeID and an updated date.
          nodes[myhostname] = { "nodeID": nodeID, "date": message.date };
          console.log('Replaced/Added entry to nodes array');
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


setInterval(function () {
  let maxID = -1;
  let maxHostName = "";
  leader = 0;
  activeNodes = 0;


  Object.entries(nodes).forEach(([hostname, prop]) => {
    // Is the current node the same hostname as the saved HostName?
    if (hostname == myhostname) {
      //Is the nodeID of this node higher than the one saved?
      if (prop.nodeID > maxID) {
        // Set max Id to the current one (which is the biggest so far!)
        maxID = prop.nodeID
        //Leader has been declared!
        leader = 1;
        // Set the maxhostname to the host name of the highest node
        maxHostName = hostname;
      }
    }

  });
  //If the hostName is equal to the leader's Host Name then it is the leader
  if (maxHostName == myhostname && leader == 1) {
    console.log('I am the leader!');

    //Get time now and also the epoch time
    let dateNow = new Date;
    let dateNowEpoch = new Date().getTime() / 1000;

    Object.entries(nodes).forEach(([hostname, prop]) => {
      // Get the difference between the time message was sent and the time now.
      let currentNodeDateConverted = new Date(prop.date).getTime() / 1000;
      let timeBetweenNodeMessage = dateNowEpoch - currentNodeDateConverted;

      //If message hasn't been received for 20 seconds
      if (timeBetweenNodeMessage < 20) {
        console.log('No need to restart container. Sending it in the correct time');
      } else {
        // Restart container
        console.log('Need to restart container. Took more than 20 seconds');
        restartContainer(myhostname);
      }

      //TODO Ash: Come back to later
      // if (dateNow.getHours() >= 16 && dateNow.getHours() <= 18) {
      //   //Scale up
      // } else if (dateNow.getHours() >= 18) {
      //   //Scale down
      // }


    });
  }
}, 5000)

async function restartContainer(hostNameToRestart) {
  if (leader == 1) {
    console.log("Restarting container");
    try {
      console.log("Stopping container: " + hostNameToRestart);
      await axios.post(`http://host.docker.internal:2375/containers/${hostNameToRestart}/stop`).then(function (response) { console.log(response) });
      console.log("Starting container: " + hostNameToRestart);
      // await axios.post(`http://host.docker.internal:2375/containers/create?name= ${myhostname}`, containerDetails).then(function (response) { console.log(response) });
      await axios.post(`http://host.docker.internal:2375/containers/${hostNameToRestart}/start`).then(function (response) { console.log(response) });;
    }
    catch (error) {
      console.log(error);
    }
  }
}