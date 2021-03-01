import config from './config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { Worker } from 'mediasoup/lib/types';
import ALLROOMS from './types/allRooms.types.';
import { Server } from 'socket.io';
import Room from './Room';
import Peer from './Peer';
import mySocket from './utils/customSocket';
import { createWorkers } from './utils/createWorker';

const https = require('httpolyglot');
const app = express();
const options = {
  keys: fs.readFileSync(path.join(__dirname, config.sslKey)),
  cert: fs.readFileSync(path.join(__dirname, config.sslCrt)),
};

const httpsServer = https.createServer(options, app);
app.use(express.static(path.join(__dirname, '..', 'public')));
const io = new Server(httpsServer);
httpsServer.listen(config.listenPort, () => console.log(`Server listening at PORT : ${config.listenPort}`));

let workers: Array<Worker> = [];
let nextWorkerIndex: number = 0;
let roomList: ALLROOMS = {};

(async () => {
  await createWorkers(workers);
})();

io.on('connection', (socket: mySocket) => {
  socket.on('createRoom', async ({ roomID }: { roomID: string }, callback) => {
    if (roomList[roomID]) {
      callback('Already exists');
    } else {
      console.log('-------ROOM CREATED---------', roomID);
      const worker = await getMSWorker();
      roomList[roomID] = new Room(roomID, worker, io);
      callback(roomID);
    }
  });

  socket.on('join', ({ roomID, name }: { roomID: string; name: string }, callback) => {
    console.log(`------USER JOINED------ \n ROOM ID : ${roomID} || USERNAME : ${name}`);
    if (!roomList[roomID]) {
      return callback({
        error: 'Room does not exist!',
      });
    }
    roomList[roomID].addPeer(new Peer(socket.id, name));
    socket.roomID = roomID;
    callback(roomList[roomID]);
  });

  socket.on('getProducers', () => {
    console.log(`------GET PRODUCER------ NAME : ${roomList[socket.roomID].getPeers()[socket.id].name}`);

    // Sends all the current producers in the room to the newly joined user
    if (!roomList[socket.roomID]) return;
    const getProducerList = roomList[socket.roomID].getProducerList(socket.id);
    socket.emit('newProducers', getProducerList);
  });
});

const getMSWorker = () => {
  const worker = workers[0];

  if (++nextWorkerIndex === workers.length) {
    {
      nextWorkerIndex = 0;
    }
  }

  return worker;
};
