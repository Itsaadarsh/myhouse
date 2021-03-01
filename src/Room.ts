import { DtlsParameters, Router, Worker } from 'mediasoup/lib/types';
import config from './config';
import { PEERTYPE, ROOM } from './types/allRooms.types.';

class Room implements ROOM {
  readonly id: string;
  router: Router;
  readonly peers: PEERTYPE;
  readonly io: any;

  constructor(roomID: string, worker: Worker, io: any) {
    this.id = roomID;
    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    worker
      .createRouter({
        mediaCodecs,
      })
      .then((router: Router) => {
        this.router = router;
      });

    this.peers = {};
    this.io = io;
  }

  addPeer(peer: any) {
    this.peers[peer.id] = peer;
  }

  getPeers() {
    return this.peers;
  }

  getProducerList() {
    const producerList: Array<{ producerID: string }> = [];
    let producer: any;
    for (let peer in this.peers) {
      for (producer in this.peers[peer].producers) {
        producerList.push({ producerID: producer.id });
      }
    }
    return producerList;
  }

  getRTPCapabilities() {
    return this.router.rtpCapabilities;
  }

  async createWebRTCTransport(socketID: string) {
    const { initialAvailableOutgoingBitrate } = config.mediasoup.webRTCTransport;
    const maxIncomingBitrate = 1500000;

    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRTCTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    });

    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (err) {
        console.error(err);
      }
    }

    transport.on('dtlsstatechange', dtlsState => {
      if (dtlsState === 'closed') {
        console.log(`------TRANSPORT CLOSED------- ${this.peers[socketID].name} CLOSED`);
        transport.close();
      }
    });

    transport.on('close', () => {
      console.log(`------TRANSPORT CLOSED------- ${this.peers[socketID].name} CLOSED`);
    });

    console.log(`----ADDING TRANSPORT----- ${transport.id}`);
    this.peers[socketID].addTransport(transport);
    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async connectPeerTransport(socketID: string, transportID: string, dtlsParameters: DtlsParameters) {
    if (!this.peers[socketID]) return;
    await this.peers[socketID].connectTransport(transportID, dtlsParameters);
  }
}

export default Room;
