FROM node:4

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ONBUILD ARG NODE_ENV
ONBUILD ENV NODE_ENV $NODE_ENV
COPY . /usr/src/app
WORKDIR /usr/src/app/dl
RUN npm install
WORKDIR /usr/src/app/web
RUN npm install

CMD [ "npm", "start" ]
