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
httpsServer.listen(config.listenPort, () =>
  console.log(`Server started at http://localhost:${config.listenPort}/`)
);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method == 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT,POST,DELETE,PATCH');
    return res.status(200).json({});
  }
  next();
  return;
});

let workers: Array<Worker> = [];
let nextWorkerIndex: number = 0;
let roomList: ALLROOMS = {};

(async () => {
  await createWorkers(workers);
})();

io.on('connection', (socket: mySocket) => {
  socket.on('getAllOpenRooms', async () => {
    if (Object.keys(roomList).length === 0) {
      return socket.emit('getAllOpenRooms', {
        msg: 'There are no open rooms',
        data: null,
        status: 200,
      });
    }
    const getRoomList: Array<any> = [];
    Object.keys(roomList).forEach(room => {
      getRoomList.push({ id: roomList[room].id, peers: roomList[room].peers });
    });
    return socket.emit('getAllOpenRooms', {
      msg: 'List of all open rooms',
      data: getRoomList,
      status: 200,
    });
  });

  socket.on('createRoom', async ({ roomID }: { roomID: string }) => {
    try {
      if (roomList[roomID]) {
        socket.emit('createRoom', { msg: 'Room already exists', data: null, status: 400 });
      } else {
        console.log('-------ROOM CREATED---------', roomID);
        const worker = await getMSWorker();
        roomList[roomID] = new Room(roomID, worker, io);
        socket.emit('createRoom', { msg: 'Room Created', data: { roomID }, status: 200 });
      }
    } catch (err) {
      console.log(err);
      socket.emit('createRoom', {
        msg: `Something went wrong at createRoom event`,
        data: null,
        status: 400,
      });
    }
  });

  socket.on('join', ({ roomID, name }: { roomID: string; name: string }) => {
    console.log(`------USER JOINED------ \n ROOM ID : ${roomID} || USERNAME : ${name}`);
    if (!roomList[roomID]) {
      return socket.emit('join', {
        msg: 'Room does not exist!',
        data: null,
        status: 400,
      });
    }
    if (Object.keys(roomList[roomID].peers).length === 0) {
      roomList[roomID].addPeer(new Peer(socket.id, name, true));
    } else {
      roomList[roomID].addPeer(new Peer(socket.id, name, false));
    }
    socket.roomID! = roomID;
    return socket.emit('join', {
      msg: `User successfully joined room ${socket.roomID!}`,
      data: { roomID },
      status: 200,
    });
  });

  socket.on('getProducers', () => {
    customLogs('GET PRODUCER', roomList, socket);
    // Sends all the current producers in the room to the newly joined user
    if (!roomList[socket.roomID!]) return;
    const getProducerList = roomList[socket.roomID!].getProducerList();
    socket.emit('newProducers', getProducerList);
  });

  socket.on('getRouterRtpCapabilities', async () => {
    customLogs('GET ROUTER RTP CAPABILITIES', roomList, socket);
    const data = await roomList[socket.roomID!].getRTPCapabilities();
    socket.emit('getRouterRtpCapabilities', {
      msg: 'Router Capabilities',
      data,
      status: 200,
    });
  });

  socket.on('createWebRtcProducerTransport', async () => {
    customLogs('CREATE WEBRTC TRANSPORTs', roomList, socket);
    try {
      const { params } = await roomList[socket.roomID!].createWebRTCTransport(socket.id);
      await socket.emit('createWebRtcProducerTransport', {
        msg: 'Creating WEBRTC transport',
        data: params,
        status: 200,
      });
    } catch (err) {
      console.log(err);
      socket.emit('createWebRtcProducerTransport', {
        msg: `Something went wrong at createRoom event`,
        data: null,
        status: 400,
      });
    }
  });

  socket.on('createWebRtcConsumerTransport', async () => {
    customLogs('CREATE WEBRTC TRANSPORTs', roomList, socket);
    try {
      const { params } = await roomList[socket.roomID!].createWebRTCTransport(socket.id);
      await socket.emit('createWebRtcConsumerTransport', {
        msg: 'Creating WEBRTC transport',
        data: params,
        status: 200,
      });
    } catch (err) {
      console.log(err);
      socket.emit('createWebRtcConsumerTransport', {
        msg: `Something went wrong at createRoom event`,
        data: null,
        status: 400,
      });
    }
  });

  socket.on(
    'connectTransport',
    async ({ transportID, dtlsParameters }: { transportID: string; dtlsParameters: DtlsParameters }) => {
      customLogs('CONNECT TRANSPORT', roomList, socket);
      if (!roomList[socket.roomID!]) return;
      await roomList[socket.roomID!].connectPeerTransport(socket.id, transportID, dtlsParameters);
    }
  );

  socket.on(
    'produce',
    async ({
      kind,
      rtpParameters,
      produceTransportID,
    }: {
      kind: MediaKind;
      rtpParameters: RtpParameters;
      produceTransportID: string;
    }) => {
      try {
        if (!roomList[socket.roomID!]) {
          return socket.emit('produce', {
            msg: 'Room does not exist!',
            data: null,
            status: 400,
          });
        }
        const producerId = await roomList[socket.roomID!].produce(
          socket.id,
          produceTransportID,
          rtpParameters,
          kind
        );
        customLogs(`PRODUCING || TYPE : ${kind}`, roomList, socket);
        return socket.emit('produce', {
          msg: 'Producer created',
          data: { producerId },
          status: 200,
        });
      } catch (err) {
        console.log(err);
        return socket.emit('createWebRtcTransport', {
          msg: `Something went wrong at createRoom event`,
          data: null,
          status: 400,
        });
      }
    }
  );

  socket.on(
    'consume',
    async ({
      consumerTransportID,
      producerId,
      rtpCapabilities,
    }: {
      consumerTransportID: string;
      producerId: string;
      rtpCapabilities: RtpCapabilities;
    }) => {
      const params = await roomList[socket.roomID!].consume(
        socket.id,
        consumerTransportID,
        producerId,
        rtpCapabilities
      );
      customLogs(`CONSUMING || CONSUMER ID : ${params?.id} || PRODUCER ID : ${producerId}`, roomList, socket);
      socket.emit('consume', {
        msg: 'Sending consumer params',
        data: params,
        status: 200,
      });
    }
  );

  socket.on('getMyPeerInfo', async () => {
    socket.emit('getMyPeerInfo', {
      msg: 'All peers info',
      data: roomList[socket.roomID!].getAllPeerInfo(),
      status: 200,
    });
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

  socket.on('exitRoom', async () => {
    customLogs(`EXIT ROOM`, roomList, socket);
    if (!roomList[socket.roomID!]) {
      return socket.emit('produce', {
        msg: 'Room does not exist!',
        data: null,
        status: 400,
      });
    }
    await roomList[socket.roomID!].removePeer(socket.id);
    if (Object.keys(roomList[socket.roomID!].getPeers()).length === 0) {
      delete roomList[socket.roomID!];
    }
    socket.roomID = null;
    return;
  });

  socket.on('beASpeaker', async () => {
    if (!roomList[socket.roomID!]) {
      return socket.emit('produce', {
        msg: 'Room does not exist!',
        data: null,
        status: 400,
      });
    }

    const admin = roomList[socket.roomID!].getAdmin();
    const getPeer = roomList[socket.roomID!].getPeer(socket.id);

    if (admin !== null && getPeer !== null) {
      io.to(admin.id).emit('speakerPermission', {
        peerData: {
          id: getPeer.id,
          name: getPeer.name,
        },
      });
    }
    return;
  });

  socket.on('speakerPermissionAccepted', async ({ socketID }: { socketID: string }, _) => {
    await roomList[socket.roomID!].becomeASpeaker(socketID);
    const getPeer = roomList[socket.roomID!].getPeer(socketID);

    if (getPeer !== null) {
      io.to(socketID).emit('speakerAccepted', {
        peerData: {
          id: getPeer.id,
          name: getPeer.name,
          isAdmin: getPeer.isAdmin,
          isListener: getPeer.isListener,
          isSpeaker: getPeer.isSpeaker,
        },
      });
    }
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
