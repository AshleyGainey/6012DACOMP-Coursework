
Features:

[x] Load Balancer - Ngnix (Helps to distribute load)

[x] 3 Container Nodes - NodeJS Nodes (HA)

[x] 3 Database Nodes - MongoDB Nodes (with NotFlix Data) (HA)

[x] 3 Message Nodes - RabbitMQ Nodes (HA)

[x] Broadcasting Publisher and Subscriber with the added Nodes to array

[x] Leadership Election

[x] Automatically adjust for failed containers

[] Auto Scaling between 16:00 - 18:00
     
     --- NOTE: partially implementated.


Instructions:

1) In your VM setup, execute the line `git clone https://github.com/AshleyGainey/6012DACOMP-Coursework/`
2) run line `sudo docker-compose build`
3) Execute line `docker-compose up`
