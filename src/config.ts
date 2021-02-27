import os from 'os';
import CONFIGTYPES from './types/config.types';

const config: CONFIGTYPES = {
  listenIp: '0.0.0.0',
  listenPort: 4000,
  sslCrt: '../ssl/cert.pem',
  sslKey: '../ssl/key.pem',

  mediasoup: {
    // Worker Settings
    numWorkers: Object.keys(os.cpus()).length,
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },

    // Router Settings
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

    // WebRTC Transport Settings
    webRTCTransport: {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: '127.0.0.1',
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
    },
  },
};

export default module.exports = config;
