FROM node:11

WORKDIR /home/node/app
COPY . .
RUN npm install

CMD ./bin/update-rotating-todoist-tasks
