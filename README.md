

# 6012DACOMP - Cloud Computing - NotFlix Solution


## Features:

[x] Load Balancer - Ngnix (Helps to distribute load)

[x] 3 Container Nodes - NodeJS Nodes (HA)

[x] 3 Database Nodes - MongoDB Nodes (with NotFlix Data) (HA)

[x] 3 Message Nodes - RabbitMQ Nodes (HA)

[x] Broadcasting Publisher and Subscriber with the added Nodes to array

[x] Leadership Election

[x] Automatically adjust for failed containers

[x] Auto Scaling between 16:00 - 18:00
     
     --- NOTE: partially implementated. - Error 404 when trying to make containers

## Programs You'll Need:
- Windows:
 - A Virtual Machine (VM) running Ubuntu Live Server. I used `ubuntu-20.04.4-live-server-amd64.iso` - [Download Link](https://releases.ubuntu.com/20.04/ubuntu-20.04.4-live-server-amd64.iso)
 - Optional: MobaXTerm (to do actions on your VM easier) - [Download Link](https://mobaxterm.mobatek.net/download-home-edition.html)

- Visual Studio Extensions:
     -   I used: REST - SSH and MongoDB for VS Code

## Stuff you'll need to change:
 - You will need to change the subscriber and publisher connecting calls to your IP address of your VM. My VM is `192.168.56.112`, yours will be different. To retrieve it, execute `ip addr` on the VM. Lines to change are `LINE` and `LINE`. As well as line `LINE` for the Docker API call.


## Instructions:
1) In your VM setup, execute the line `git clone https://github.com/AshleyGainey/6012DACOMP-Coursework/`. Git Not installed? Follow [this guide](https://www.digitalocean.com/community/tutorials/how-to-install-git-on-ubuntu-20-04) to download it

       --- NOTE: The nodes name will be the following: TitleOfRepoFolder_node[x]_1
2) You should already have Docker and Docker API installed and configured but if not here is how to get them:

### Docker Installation
3) Execute the line: `sudo apt install apt-transport-https ca- certificates curl software-properties-common`
4) Execute: `curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -`
5) Execute: `sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"`
6) Execute: `sudo apt update`
7) Execute: `sudo apt install docker-ce`
8) Check the status of Docker and whether it has installed : `sudo systemctl status docker`


### Docker API Installation
9) Enable the Docker API in your VM by modifying the file and executing this line: `sudo vi /lib/systemd/system/docker.service` 
10) Find the line “ExecStart=/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock” and at the end of it, add the following: `-H tcp://0.0.0.0:2375`. 
11) Restart Docker, execute line `sudo systemctl daemon-reload` and then `sudo systemctl restart docker.service`.
12) Confirm that we have restarted Docker API correctly by running `sudo service docker status` and see if the green active text is there.
13) Install wget by executing the line `sudo apt install wget`


### Now Ready to Run the solution
14) Run the line `sudo docker-compose build`
15) Execute the line `docker-compose up`.
16) You should be able to see the 3 nodes spin up and with time, RabbitMQ should stop and start 3 times to bring up stats, ram and disc nodes. If you are receiving an error of `Error: Socket closed abruptly during opening handshake`. This means that RabbitMQ hasn't fully set up set. Just wait until it has and you should then see that each node is now sending and receiving messages.
17) To confirm whether RabbitMQ is up and running, you can visit the localhost of RabbitMQ, it is the IP Address of the VM and then `:15672` at the end. For example: http://192.168.56.112/15672. 
- RabbitMQ Sign in details:
     - Username: user
     - Password: bitnami
18) Now you can see the stats, ram and disc nodes up and running and if you press the `Overview` button, where it says connections, there should be 3 nodes. This means that node1, node2, node3 are connected to RabbitMQ.

## Features Tests

### 3 Database Nodes - MongoDB Nodes (with NotFlix Data) (HA)
1) Open up MongoDB for VS Code in Visual Studio Code, and add a new connection, then select 'Connect with connectionString' and use this connection 'mongodb://localmongo1:27017,localmongo2:27017,localmongo3:27017/otFlixDB?replicaSet=rs0'. Using a new playround, and then use the contents from the playground.mongodb to set up the database and it will insert some fields into there. Press the Green Run/Play button at the right of the screen.
3) Open up the to the testData.http file in the mongoDBTests folder and Select 'Send Request' (will only show if the Rest Client extension is installed) on the queries to test the connection and whether you can addd and retreive data.




###  Broadcasting Publisher and Subscriber with the added Nodes to array - Communication between Nodes
1) When a node has started, you should see a message being executed to the console every 3 seconds saying that 'Mongo JS code now executing'.
2) When a node is trying to send a message, you will see a message in the console saying 'Sending the alive message. Host Name: node[x] The Node ID: 12'
3) When a node is trying to receve a message, you will see a message in the console saying '[*] Waiting for messages in %s. To exit press CTRL+C'.
4) When received, the node should print out the message in the line to the console with something like: 'Subscriber received:{"hostName":"node[x]","status":"Alive","nodeID":12,"date":1650852923.629}'. It then adds this message to an array of alive nodes that each container has it's own version of and if already existing in the node, it prints out 'Replaced entry in node array', if it is a new entry (a.k.a new container, then it prints out 'Added entry to node array' 
6) To verify that all nodes are up and talking to each other, the system prints out '--------- Nodes array print out Start ----------' then it loops through the alive nodes list and for each prints out the hostname, the nodeId, the status and what time it was received to us. After it has looped through all of them, there will be a message printed to the console to tell you that it has ended it's loop '--------- Nodes array print out End ----------'. At first, the output should show three entries in the nodes list.

For example:

![image](https://user-images.githubusercontent.com/28976914/165028193-dc374f28-1d80-4020-b483-eea95da40cc4.png)


### Leadership Election
1) The leading node when elected prints out a line to the console to tell you that it is the leader saying 'I, node[x], am the leader'. 
--- NOTE: Sometimes when RabbitMQ hasn't started properly, every node is declared the leader, this is not true, I have tried to make sure this part of the code does not execute because RabbitMQ has started up properly but I am unaware if this completely works.
2) You will also be able to know who is the leader by looking at the above screenshot and seeing who has the highest node ID.

Please Note:

3) If the leader node is killed and destroyed, the remaining nodes will be compared and from there, whomever has the highest number will be automatically be the leader. This will happen after 10 seconds of killing the node (due to the dead node being removed from the alive nodes list).

### Automatically adjusting for failed containers
1) To kill a container, take the build into the background by pressing `Ctrl + Z`, execute the following `kill 6012dacomp-coursework_node[x]_1` to kill the container and then bring the build back to the foreground by entering `fg`.**
1) If a node has died or hasn't broadcasted a message for at least 10 seconds, it will be outputted to the console saying that 'node[x] is dead and has been removed from the nodes array', it will then be removed from the node list (which stores the alive list and after that will then try to spin up the old container. If a node is still alive then for it print that to the console too. The left side of the console will show you were the console message have came from, either node1, node2, node3 etc. You should now not be able to see updated logs for the node that you killed - This can be another way to confirm that the container has been killed.
3) The killed container will then be restarted and you will be able to see the node you killed back up and running after a few seconds! A message saying 'Mongo JS code now executing' from the node should show you evidence of this (the left side of the console will show you were the message has came from node1, node2, node3 etc.) - This should be used to confirm that the container has been restarted.
You can manually kill a node in Docker Desktop by clicking the "Containers / Apps" tab, expanding the project folder and pressing the stop button on a node you wish to kill.
4) This restarting node will then be adde to the nodes array after about 2 seconds of starting and due to this can can run the leadership code over again and check if the new NodeID is higher than the others stored in the alive array and if it is, then that node that has just started will be the leader which again, you'll be able to see in the console (refer to the Leadership election testing for more details.

### Peak Hours - Scale Up - Currently giving a 404 error
1) When there is the peak hours of NotFlix users online from 4pm - 6pm, the application will try to create 2 new containers, node4 and node5. You can see that it gets to the peak hour scale up part when the console logs 'Peak hours has started. 2 New containers are being created and started'
2) It will go off and create the new containers and then try to start them up. At the moment, as I have mentioned, it currently gives a 404 error and I have not been able to look into why. So therefore, this code does not work currently. 


### Peak Hours - Scale Down - Not tested due to Scale Up not working
1) When the peak hours is the peak time of NotFlix users online is over (before 4pm or after 6pm), the application will try to kill the containers of node4 and node5. You can see that it gets to the peak hour scale down part when the console logs 'Peak hours has ended. Killing the new containers we spun up before'
2) It will go off and kill the new containers. At the moment, as I have mentioned, the Scale up section is currently gives a 404 error and I have not been able to look into why. So therefore, this code has not been updated
