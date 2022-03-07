FROM alpine 
RUN apk add --update nodejs npm 
WORKDIR /usr/src/app 
EXPOSE 3000 
COPY cloud-week1/ . 
RUN ls -la /usr/src/app/* 
RUN npm install 
CMD [ "node", "test.js" ] 
