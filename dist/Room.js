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
const config_1 = require("./config");
const customConsoleLogs_1 = __importDefault(require("./utils/customConsoleLogs"));
class Room {
    constructor(roomID, worker, io) {
        this.id = roomID;
        const mediaCodecs = config_1.config.mediasoup.router.mediaCodecs;
        worker
            .createRouter({
            mediaCodecs,
        })
            .then((router) => {
            this.router = router;
        });
        this.peers = {};
        this.io = io;
    }
    addPeer(peer) {
        this.peers[peer.id] = peer;
    }
    getPeers() {
        return this.peers;
    }
    getProducerList() {
        const producerList = [];
        let producer;
        for (let peer in this.peers) {
            for (producer in this.peers[peer].producers) {
                producerList.push({ producerId: producer });
            }
        }
        return producerList;
    }
    getRTPCapabilities() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.router.rtpCapabilities;
        });
    }
    createWebRTCTransport(socketID) {
        return __awaiter(this, void 0, void 0, function* () {
            const { initialAvailableOutgoingBitrate } = config_1.config.mediasoup.webRtcTransport;
            const transport = yield this.router.createWebRtcTransport({
                listenIps: config_1.config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate,
            });
            transport.on('dtlsstatechange', dtlsState => {
                if (dtlsState === 'closed') {
                    customConsoleLogs_1.default(`------TRANSPORT CLOSED------- || ${this.peers[socketID].name} CLOSED`);
                    transport.close();
                }
            });
            transport.on('close', () => {
                customConsoleLogs_1.default(`------TRANSPORT CLOSED------- || ${this.peers[socketID].name} CLOSED`);
            });
            customConsoleLogs_1.default(`----ADDING TRANSPORT----- || ${transport.id}`);
            this.peers[socketID].addTransport(transport);
            return {
                params: {
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                },
            };
        });
    }
    connectPeerTransport(socketID, transportID, dtlsParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.peers[socketID])
                return;
            yield this.peers[socketID].connectTransport(transportID, dtlsParameters);
        });
    }
    produce(socketID, produceTransportID, rtpParameters, kind) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, _) => __awaiter(this, void 0, void 0, function* () {
                const producer = yield this.peers[socketID].createProducer(produceTransportID, rtpParameters, kind);
                resolve(producer.id);
                this.brodCast(socketID, 'newProducers', [
                    {
                        producerId: producer.id,
                        producerSocketID: socketID,
                    },
                ]);
            }));
        });
    }
    brodCast(sockerID, eventName, data) {
        for (let otherID of Array.from(Object.keys(this.peers)).filter(id => id !== sockerID)) {
            this.io.to(otherID).emit(eventName, data);
        }
    }
    consume(socketID, consumerTransportID, producerId, rtpCapabilities) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.router.canConsume({ producerId: producerId, rtpCapabilities })) {
                console.error('Can not CONSUME');
                return;
            }
            const response = yield this.peers[socketID].createConsumer(consumerTransportID, producerId, rtpCapabilities);
            response === null || response === void 0 ? void 0 : response.consumer.on('producerclose', () => {
                customConsoleLogs_1.default(`CONSUMER CLOSED (Due to produerclose event) || CONSUMER ID ${response === null || response === void 0 ? void 0 : response.consumer.id}`);
                this.peers[socketID].removeConsumer(response === null || response === void 0 ? void 0 : response.consumer.id);
                this.io.to(socketID).emit('consumerClosed', { consumerID: response === null || response === void 0 ? void 0 : response.consumer.id });
            });
            return response === null || response === void 0 ? void 0 : response.params;
        });
    }
    removePeer(socketID) {
        return __awaiter(this, void 0, void 0, function* () {
            this.peers[socketID].close();
            delete this.peers[socketID];
        });
    }
    closeProducer(socketID, producerId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.peers[socketID].closeProducer(producerId);
        });
    }
    getAllPeerInfo() {
        const peerList = [];
        for (let peerKey in this.peers) {
            peerList.push({
                id: this.peers[peerKey].id,
                name: this.peers[peerKey].name,
                isSpeaker: this.peers[peerKey].isSpeaker,
                isListener: this.peers[peerKey].isListener,
                isAdmin: this.peers[peerKey].isAdmin,
            });
        }
        return {
            roomID: this.id,
            peers: peerList,
        };
    }
    becomeASpeaker(sockerID) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.peers[sockerID])
                return;
            yield this.peers[sockerID].speakerPermission();
        });
    }
    getAdmin() {
        for (let peerKey in this.peers) {
            if (this.peers[peerKey].isAdmin) {
                return this.peers[peerKey];
            }
        }
        return null;
    }
    getPeer(peerID) {
        for (let peerKey in this.peers) {
            if (this.peers[peerKey].id === peerID) {
                return this.peers[peerKey];
            }
        }
        return null;
    }
    toJson() {
        return {
            id: this.id,
            peers: JSON.stringify([this.peers]),
        };
    }
}
exports.default = Room;
//# sourceMappingURL=Room.js.map