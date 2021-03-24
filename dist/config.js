"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = __importDefault(require("os"));
const config = {
    listenIp: '0.0.0.0',
    listenPort: 4000,
    mediasoup: {
        numWorkers: Object.keys(os_1.default.cpus()).length,
        worker: {
            rtcMinPort: 10000,
            rtcMaxPort: 10100,
            logLevel: 'warn',
            logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        },
        router: {
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
            ],
        },
        webRTCTransport: {
            listenIps: [
                {
                    ip: '127.0.0.1',
                    announcedIp: null,
                },
            ],
            initialAvailableOutgoingBitrate: 1000000,
        },
    },
    maxIncomingBitrate: 1500000,
};
exports.default = module.exports = config;
//# sourceMappingURL=config.js.map