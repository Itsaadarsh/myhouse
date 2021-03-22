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
const customConsoleLogs_1 = __importDefault(require("./utils/customConsoleLogs"));
class Peer {
    constructor(socketID, name, creatorBool) {
        (this.id = socketID),
            (this.name = name),
            (this.transports = {}),
            (this.consumers = {}),
            (this.producers = {});
        if (creatorBool) {
            this.isAdmin = true;
            this.isSpeaker = true;
            this.isListener = false;
        }
        else {
            this.isAdmin = false;
            this.isListener = true;
            this.isSpeaker = false;
        }
    }
    addTransport(transport) {
        this.transports[transport.id] = transport;
    }
    connectTransport(transportID, dtlsParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.transports[transportID])
                return;
            yield this.transports[transportID].connect({ dtlsParameters });
        });
    }
    createProducer(produceTransportID, rtpParameters, kind) {
        return __awaiter(this, void 0, void 0, function* () {
            const producer = yield this.transports[produceTransportID].produce({ kind, rtpParameters });
            this.producers[producer.id] = producer;
            producer.on('transportclose', () => {
                customConsoleLogs_1.default(`PRODUCER TRANSPORT CLOSE || CONSUMER ID : ${producer.id}`);
                producer.close();
                delete this.producers[producer.id];
            });
            return producer;
        });
    }
    createConsumer(consumerTransportID, producerId, rtpCapabilities) {
        return __awaiter(this, void 0, void 0, function* () {
            const consumerTransport = this.transports[consumerTransportID];
            let consumer = null;
            try {
                consumer = yield consumerTransport.consume({
                    producerId: producerId,
                    rtpCapabilities,
                    paused: false,
                });
            }
            catch (err) {
                console.error('Consuming Failed', err);
                return;
            }
            if (consumer.type === 'simulcast') {
                yield consumer.setPreferredLayers({
                    spatialLayer: 2,
                    temporalLayer: 2,
                });
            }
            this.consumers[consumer.id] = consumer;
            consumer.on('transportclose', () => {
                customConsoleLogs_1.default(`CONSUMER TRANSPORT CLOSE || CONSUMER ID : ${consumer.id}`);
                delete this.consumers[consumer.id];
            });
            return {
                consumer,
                params: {
                    producerId: producerId,
                    id: consumer.id,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                    type: consumer.type,
                    producerPaused: consumer.producerPaused,
                },
            };
        });
    }
    removeConsumer(consumerID) {
        delete this.consumers[consumerID];
    }
    close() {
        for (let transport in this.transports) {
            this.transports[transport].close();
        }
    }
    closeProducer(producerId) {
        try {
            this.producers[producerId].close();
        }
        catch (err) {
            console.warn(err);
        }
        delete this.producers[producerId];
    }
    speakerPermission() {
        (this.isListener = false), (this.isSpeaker = true);
    }
}
exports.default = Peer;
//# sourceMappingURL=Peer.js.map