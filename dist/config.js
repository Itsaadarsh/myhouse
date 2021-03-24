"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const os_1 = __importDefault(require("os"));
exports.config = {
    httpIp: '0.0.0.0',
    httpPort: 3000,
    httpPeerStale: 360000,
    mediasoup: {
        numWorkers: Object.keys(os_1.default.cpus()).length,
        worker: {
            rtcMinPort: 40000,
            rtcMaxPort: 49999,
            logLevel: 'debug',
            logTags: [
                'info',
                'ice',
                'dtls',
                'rtp',
                'srtp',
                'rtcp',
            ],
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
        webRtcTransport: {
            listenIps: [
                {
                    ip: process.env.WEBRTC_LISTEN_IP || '127.0.0.1',
                    announcedIp: process.env.A_IP || undefined,
                },
            ],
            initialAvailableOutgoingBitrate: 800000,
        },
    },
};
//# sourceMappingURL=config.js.map