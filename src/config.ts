import os from 'os';
// import CONFIGTYPES from './types/config.types';

// const config: CONFIGTYPES = {
//   listenIp: '0.0.0.0',
//   listenPort: 4000,

//   mediasoup: {
//     // Worker settings
//     numWorkers: Object.keys(os.cpus()).length,
//     worker: {
//       rtcMinPort: 10000,
//       rtcMaxPort: 10100,
//       logLevel: 'warn',
//       logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
//     },
//     // Router settings
//     router: {
//       mediaCodecs: [
//         {
//           kind: 'audio',
//           mimeType: 'audio/opus',
//           clockRate: 48000,
//           channels: 2,
//         },
//       ],
//     },
//     // WebRtcTransport
//     webRTCTransport: {
//       listenIps: [
//         {
//           ip: '127.0.0.1',
//           announcedIp: null,
//         },
//       ],
//       initialAvailableOutgoingBitrate: 1000000,
//     },
//   },
//   maxIncomingBitrate: 1500000,
// };

// export default module.exports = config;
import { RtpCodecCapability, TransportListenIp, WorkerLogTag } from 'mediasoup/lib/types';

export const config = {
  // http server ip, port, and peer timeout constant
  //
  httpIp: '0.0.0.0',
  httpPort: 3000,
  httpPeerStale: 360000,

  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,

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
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ] as WorkerLogTag[],
    },
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
      ] as RtpCodecCapability[],
    },

    // rtp listenIps are the most important thing, below. you'll need
    // to set these appropriately for your network for the demo to
    // run anywhere but on localhost
    webRtcTransport: {
      listenIps: [
        {
          ip: process.env.WEBRTC_LISTEN_IP || '127.0.0.1',
          announcedIp: process.env.A_IP || undefined,
        },
        // { ip: "192.168.42.68", announcedIp: null },
        // { ip: '10.10.23.101', announcedIp: null },
      ] as TransportListenIp[],
      initialAvailableOutgoingBitrate: 800000,
    },
  },
} as const;
