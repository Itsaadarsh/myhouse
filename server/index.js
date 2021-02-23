const express = require('express');
const http = require('http');
const socket = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const houses = {};

io.on('connection', socket => {
  socket.on('join', houseID => {
    if (houses[houseID]) {
      houses[houseID].push(socket.id);
    } else {
      houses[houseID] = [socket.id];
    }

    const secondPerson = houses[houseID].find(id => id !== socket.id);

    if (secondPerson) {
      socket.emit('secondUser', secondPerson);
      socket.to(secondPerson).emit('userJoined', socket.id);
    }
  });

  socket.on('offer', payload => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', payload => {
    io.to(payload.target).emit('answer', payload);
  });

  socket.on('ice-candidate', incoming => {
    io.to(incoming.target).emit('ice-candidate', incoming.candidate);
  });
});

server.listen(4000, () => {
  console.log('Server started at 4000');
});
