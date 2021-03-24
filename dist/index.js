"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const config_1 = require("./config");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const Room_1 = __importDefault(require("./Room"));
const Peer_1 = __importDefault(require("./Peer"));
const customConsoleLogs_1 = __importDefault(require("./utils/customConsoleLogs"));
const socket_io_1 = require("socket.io");
const createWorker_1 = require("./utils/createWorker");
const http = require('http');
const app = express_1.default();
const httpsServer = http.createServer(app);
const io = new socket_io_1.Server(httpsServer);
httpsServer.listen(process.env.PORT || config_1.config.httpPort, () => console.log(`Server started at http://localhost:${process.env.PORT || config_1.config.httpPort}/`));
if (process.env.PROD) {
    app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
}
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method == 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT,POST,DELETE,PATCH');
        return res.status(200).json({});
    }
    next();
    return;
});
let workers = [];
let nextWorkerIndex = 0;
let roomList = {};
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield createWorker_1.createWorkers(workers);
}))();
io.on('connection', (socket) => {
    socket.on('getAllOpenRooms', () => __awaiter(void 0, void 0, void 0, function* () {
        if (Object.keys(roomList).length === 0) {
            return socket.emit('getAllOpenRooms', {
                msg: 'There are no open rooms',
                data: null,
                status: 200,
            });
        }
        const getRoomList = [];
        Object.keys(roomList).forEach(room => {
            getRoomList.push({ id: roomList[room].id, peers: roomList[room].peers });
        });
        return socket.emit('getAllOpenRooms', {
            msg: 'List of all open rooms',
            data: getRoomList,
            status: 200,
        });
    }));
    socket.on('createRoom', ({ roomID }) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (roomList[roomID]) {
                socket.emit('createRoom', { msg: 'Room already exists', data: null, status: 400 });
            }
            else {
                console.log('-------ROOM CREATED---------', roomID);
                const worker = yield getMSWorker();
                roomList[roomID] = new Room_1.default(roomID, worker, io);
                socket.emit('createRoom', { msg: 'Room Created', data: { roomID }, status: 200 });
            }
        }
        catch (err) {
            console.log(err);
            socket.emit('createRoom', {
                msg: `Something went wrong at createRoom event`,
                data: null,
                status: 400,
            });
        }
    }));
    socket.on('join', ({ roomID, name }) => {
        console.log(`------USER JOINED------ \n ROOM ID : ${roomID} || USERNAME : ${name}`);
        if (!roomList[roomID]) {
            return socket.emit('join', {
                msg: 'Room does not exist!',
                data: null,
                status: 400,
            });
        }
        if (Object.keys(roomList[roomID].peers).length === 0) {
            roomList[roomID].addPeer(new Peer_1.default(socket.id, name, true));
        }
        else {
            roomList[roomID].addPeer(new Peer_1.default(socket.id, name, false));
        }
        socket.roomID = roomID;
        io.sockets.emit('getMyPeerInfo', {
            msg: 'All peers info',
            data: roomList[socket.roomID].getAllPeerInfo(),
            status: 200,
        });
        return socket.emit('join', {
            msg: `User successfully joined room ${socket.roomID}`,
            data: { roomID },
            status: 200,
        });
    });
    socket.on('getProducers', () => {
        customConsoleLogs_1.default('GET PRODUCER', roomList, socket);
        if (!roomList[socket.roomID])
            return;
        const getProducerList = roomList[socket.roomID].getProducerList();
        socket.emit('newProducers', getProducerList);
    });
    socket.on('getRouterRtpCapabilities', () => __awaiter(void 0, void 0, void 0, function* () {
        customConsoleLogs_1.default('GET ROUTER RTP CAPABILITIES', roomList, socket);
        const data = yield roomList[socket.roomID].getRTPCapabilities();
        socket.emit('getRouterRtpCapabilities', {
            msg: 'Router Capabilities',
            data,
            status: 200,
        });
    }));
    socket.on('createWebRtcProducerTransport', () => __awaiter(void 0, void 0, void 0, function* () {
        customConsoleLogs_1.default('CREATE WEBRTC TRANSPORTs', roomList, socket);
        try {
            const { params } = yield roomList[socket.roomID].createWebRTCTransport(socket.id);
            yield socket.emit('createWebRtcProducerTransport', {
                msg: 'Creating WEBRTC transport',
                data: params,
                status: 200,
            });
        }
        catch (err) {
            console.log(err);
            socket.emit('createWebRtcProducerTransport', {
                msg: `Something went wrong at createRoom event`,
                data: null,
                status: 400,
            });
        }
    }));
    socket.on('createWebRtcConsumerTransport', () => __awaiter(void 0, void 0, void 0, function* () {
        customConsoleLogs_1.default('CREATE WEBRTC TRANSPORTs', roomList, socket);
        try {
            const { params } = yield roomList[socket.roomID].createWebRTCTransport(socket.id);
            yield socket.emit('createWebRtcConsumerTransport', {
                msg: 'Creating WEBRTC transport',
                data: params,
                status: 200,
            });
        }
        catch (err) {
            console.log(err);
            socket.emit('createWebRtcConsumerTransport', {
                msg: `Something went wrong at createRoom event`,
                data: null,
                status: 400,
            });
        }
    }));
    socket.on('connectTransport', ({ transportID, dtlsParameters }) => __awaiter(void 0, void 0, void 0, function* () {
        customConsoleLogs_1.default('CONNECT TRANSPORT', roomList, socket);
        if (!roomList[socket.roomID])
            return;
        yield roomList[socket.roomID].connectPeerTransport(socket.id, transportID, dtlsParameters);
    }));
    socket.on('produce', ({ kind, rtpParameters, produceTransportID, }) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!roomList[socket.roomID]) {
                return socket.emit('produce', {
                    msg: 'Room does not exist!',
                    data: null,
                    status: 400,
                });
            }
            const producerId = yield roomList[socket.roomID].produce(socket.id, produceTransportID, rtpParameters, kind);
            customConsoleLogs_1.default(`PRODUCING || TYPE : ${kind}`, roomList, socket);
            return socket.emit('produce', {
                msg: 'Producer created',
                data: { producerId },
                status: 200,
            });
        }
        catch (err) {
            console.log(err);
            return socket.emit('createWebRtcTransport', {
                msg: `Something went wrong at createRoom event`,
                data: null,
                status: 400,
            });
        }
    }));
    socket.on('consume', ({ consumerTransportID, producerId, rtpCapabilities, }) => __awaiter(void 0, void 0, void 0, function* () {
        const params = yield roomList[socket.roomID].consume(socket.id, consumerTransportID, producerId, rtpCapabilities);
        customConsoleLogs_1.default(`CONSUMING || CONSUMER ID : ${params === null || params === void 0 ? void 0 : params.id} || PRODUCER ID : ${producerId}`, roomList, socket);
        socket.emit('consume', {
            msg: 'Sending consumer params',
            data: params,
            status: 200,
        });
    }));
    socket.on('getMyPeerInfo', () => __awaiter(void 0, void 0, void 0, function* () {
        socket.emit('getMyPeerInfo', {
            msg: 'All peers info',
            data: roomList[socket.roomID].getAllPeerInfo(),
            status: 200,
        });
    }));
    socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
        customConsoleLogs_1.default(`DISCONNECTED`, roomList, socket);
        if (!socket.roomID)
            return;
        yield roomList[socket.roomID].removePeer(socket.id);
        yield io.sockets.emit('removepeer', {
            msg: 'Removing disconnected peer',
            data: socket.id,
            status: 200,
        });
    }));
    socket.on('producerClosed', ({ producerId }) => {
        customConsoleLogs_1.default(`PRODUCER CLOSED`, roomList, socket);
        roomList[socket.roomID].closeProducer(socket.id, producerId);
    });
    socket.on('exitRoom', () => __awaiter(void 0, void 0, void 0, function* () {
        customConsoleLogs_1.default(`EXIT ROOM`, roomList, socket);
        if (!roomList[socket.roomID]) {
            return socket.emit('produce', {
                msg: 'Room does not exist!',
                data: null,
                status: 400,
            });
        }
        yield roomList[socket.roomID].removePeer(socket.id);
        if (Object.keys(roomList[socket.roomID].getPeers()).length === 0) {
            delete roomList[socket.roomID];
        }
        socket.roomID = null;
        yield io.sockets.emit('removepeer', {
            msg: 'Removing disconnected peer',
            data: socket.id,
            status: 200,
        });
        return;
    }));
    socket.on('beASpeaker', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!roomList[socket.roomID]) {
            return socket.emit('produce', {
                msg: 'Room does not exist!',
                data: null,
                status: 400,
            });
        }
        const admin = roomList[socket.roomID].getAdmin();
        const getPeer = roomList[socket.roomID].getPeer(socket.id);
        if (admin !== null && getPeer !== null) {
            io.to(admin.id).emit('speakerPermission', {
                peerData: {
                    id: getPeer.id,
                    name: getPeer.name,
                },
            });
        }
        return;
    }));
    socket.on('speakerPermissionAccepted', ({ socketID }, _) => __awaiter(void 0, void 0, void 0, function* () {
        yield roomList[socket.roomID].becomeASpeaker(socketID);
        const getPeer = roomList[socket.roomID].getPeer(socketID);
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
        io.sockets.emit('getMyPeerInfo', {
            msg: 'All peers info',
            data: roomList[socket.roomID].getAllPeerInfo(),
            status: 200,
        });
    }));
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
//# sourceMappingURL=index.js.map