import config from './config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import ALLROOMS from './types/allRooms.types.';
import Room from './Room';
import Peer from './Peer';
import mySocket from './utils/customSocket';
import customLogs from './utils/customConsoleLogs';
import { Server } from 'socket.io';
import { DtlsParameters, MediaKind, RtpCapabilities, RtpParameters, Worker } from 'mediasoup/lib/types';
import { createWorkers } from './utils/createWorker';
const https = require('httpolyglot');

const app = express();
const options = {
  keys: fs.readFileSync(path.join(__dirname, config.sslKey)),
  cert: fs.readFileSync(path.join(__dirname, config.sslCrt)),
};

const httpsServer = https.createServer(options, app);
const io = new Server(httpsServer);
httpsServer.listen(config.listenPort, () => console.log(`Server listening at PORT : ${config.listenPort}`));

app.use(express.static(path.join(__dirname, '..', 'public')));

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
    if (Object.keys(roomList[roomID].peers).length === 0) {
      roomList[roomID].addPeer(new Peer(socket.id, name, true));
    } else {
      roomList[roomID].addPeer(new Peer(socket.id, name, false));
    }
    socket.roomID! = roomID;
    callback({});
  });

  socket.on('getProducers', () => {
    customLogs('GET PRODUCER', roomList, socket);
    // Sends all the current producers in the room to the newly joined user
    if (!roomList[socket.roomID!]) return;
    const getProducerList = roomList[socket.roomID!].getProducerList();
    socket.emit('newProducers', getProducerList);
  });

  socket.on('getRouterRtpCapabilities', (_, callback) => {
    customLogs('GET ROUTER RTP CAPABILITIES', roomList, socket);
    try {
      callback(roomList[socket.roomID!].getRTPCapabilities());
    } catch (err) {
      callback({
        error: err.message,
      });
    }
  });

  socket.on('createWebRtcTransport', async (_, callback) => {
    customLogs('CREATE WEBRTC TRANSPORTs', roomList, socket);
    try {
      const { params } = await roomList[socket.roomID!].createWebRTCTransport(socket.id);
      callback(params);
    } catch (err) {
      console.error(err);
      callback({
        error: err.message,
      });
    }
  });

  socket.on(
    'connectTransport',
    async (
      { transportID, dtlsParameters }: { transportID: string; dtlsParameters: DtlsParameters },
      callback
    ) => {
      customLogs('CONNECT TRANSPORT', roomList, socket);
      if (!roomList[socket.roomID!]) return;
      await roomList[socket.roomID!].connectPeerTransport(socket.id, transportID, dtlsParameters);
      callback('Success');
    }
  );

  socket.on(
    'produce',
    async (
      {
        kind,
        rtpParameters,
        produceTransportID,
      }: { kind: MediaKind; rtpParameters: RtpParameters; produceTransportID: string },
      callback
    ) => {
      if (!roomList[socket.roomID!]) {
        return callback({ error: 'No ROOM found' });
      }
      const producerId = await roomList[socket.roomID!].produce(
        socket.id,
        produceTransportID,
        rtpParameters,
        kind
      );
      customLogs(`PRODUCING || TYPE : ${kind}`, roomList, socket);
      callback({ producerId });
    }
  );

  socket.on(
    'consume',
    async (
      {
        consumerTransportID,
        producerId,
        rtpCapabilities,
      }: { consumerTransportID: string; producerId: string; rtpCapabilities: RtpCapabilities },
      callback
    ) => {
      const params = await roomList[socket.roomID!].consume(
        socket.id,
        consumerTransportID,
        producerId,
        rtpCapabilities
      );
      customLogs(`CONSUMING || CONSUMER ID : ${params?.id} || PRODUCER ID : ${producerId}`, roomList, socket);
      callback(params);
    }
  );

  socket.on('getMyPeerInfo', async (_, callback) => {
    callback(roomList[socket.roomID!].getPeerInfo());
  });

  socket.on('disconnect', () => {
    customLogs(`DISCONNECTED`, roomList, socket);
    if (!socket.roomID!) return;
    roomList[socket.roomID!].removePeer(socket.id);
  });

  socket.on('producerClosed', ({ producerId }: { producerId: string }) => {
    customLogs(`PRODUCER CLOSED`, roomList, socket);
    roomList[socket.roomID!].closeProducer(socket.id, producerId);
  });

  socket.on('exitRoom', async (_, callback) => {
    customLogs(`EXIT ROOM`, roomList, socket);
    if (!roomList[socket.roomID!]) {
      callback({
        error: 'Room not available',
      });
      return;
    }
    await roomList[socket.roomID!].removePeer(socket.id);
    if (Object.keys(roomList[socket.roomID!].getPeers()).length === 0) {
      delete roomList[socket.roomID!];
    }
    socket.roomID = null;
    callback('ROOM EXITED');
  });

  socket.on('beASpeaker', async (_, callback) => {
    if (!roomList[socket.roomID!]) {
      return callback({ error: 'No ROOM found' });
    }
    await roomList[socket.roomID!].becomeASpeaker(socket.id);
    callback({});
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
