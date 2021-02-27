import config from './config';
import express from 'express';
// import mediasoup from 'mediasoup';
import path from 'path';
import fs from 'fs';
import { Worker } from 'mediasoup/lib/types';
import { ROOM } from './types/allRooms.types.';
import { createWorker } from 'mediasoup';
import { Server, Socket } from 'socket.io';
import Room from './Room';

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

let roomList = new Map<string, ROOM>();

const createWorkers = async () => {
  let { numWorkers } = config.mediasoup;

  for (let i = 0; i < numWorkers; i++) {
    const worker = await createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on('died', () => {
      console.error('MS worker died, exiting..', worker.pid);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
};

(async () => {
  await createWorkers();
})();

io.on('connection', (socket: Socket) => {
  socket.on('createRoom', async ({ roomID }, callback) => {
    if (roomList.has(roomID)) {
      callback('Already exists');
    } else {
      console.log('-------ROOM CREATED---------', roomID);
      const worker = await getMSWorker();
      roomList.set(roomID, new Room(roomID, worker, io));
      callback(roomID);
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
