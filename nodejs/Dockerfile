FROM alpine
RUN apk add --update nodejs npm
WORKDIR /usr/src/app
EXPOSE 3000
EXPOSE 5672
COPY src/ .
RUN ls -la /usr/src/app*
RUN npm install express
RUN npm install mongoose
RUN npm install request
RUN npm install amqplib
RUN npm install axios
RUN npm install pm2 -g
CMD [ "pm2-runtime", "mongo.js"]
