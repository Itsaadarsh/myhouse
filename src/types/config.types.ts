import { RouterOptions, WebRtcTransportOptions, WorkerSettings } from 'mediasoup/lib/types';

export default interface CONFIGTYPES {
  listenIp: string;
  listenPort: number;
  mediasoup: {
    numWorkers: number;
    worker: WorkerSettings;
    router: RouterOptions;
    webRTCTransport: WebRtcTransportOptions;
  };
  maxIncomingBitrate: number;
}
