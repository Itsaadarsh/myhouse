import os from 'os';
import CONFIGTYPES from './types/config.types';

const config: CONFIGTYPES = {
  listenIp: '0.0.0.0',
  listenPort: 4000,

  mediasoup: {
    // Worker settings
    numWorkers: Object.keys(os.cpus()).length,
    worker: {
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    },
    // Router settings
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
    // WebRtcTransport
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

export default module.exports = config;
