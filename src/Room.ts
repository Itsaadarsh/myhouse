import {
  DtlsParameters,
  MediaKind,
  Router,
  RtpCapabilities,
  RtpParameters,
  Worker,
} from 'mediasoup/lib/types';
import { config } from './config';
import { PEERTYPE, ROOM } from './types/allRooms.types.';
import customLogs from './utils/customConsoleLogs';

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
    const producerList: Array<{ producerId: string }> = [];
    let producer: any;
    for (let peer in this.peers) {
      for (producer in this.peers[peer].producers) {
        producerList.push({ producerId: producer });
      }
    }
    return producerList;
  }

  async getRTPCapabilities() {
    return this.router.rtpCapabilities;
  }

  async createWebRTCTransport(socketID: string) {
    const { initialAvailableOutgoingBitrate } = config.mediasoup.webRtcTransport;
    // const maxIncomingBitrate = config.maxIncomingBitrate;
    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    });

    // if (maxIncomingBitrate) {
    //   try {
    //     await transport.setMaxIncomingBitrate(maxIncomingBitrate);
    //   } catch (err) {
    //     console.error(err);
    //   }
    // }

    transport.on('dtlsstatechange', dtlsState => {
      if (dtlsState === 'closed') {
        customLogs(`------TRANSPORT CLOSED------- || ${this.peers[socketID].name} CLOSED`);
        transport.close();
      }
    });

    transport.on('close', () => {
      customLogs(`------TRANSPORT CLOSED------- || ${this.peers[socketID].name} CLOSED`);
    });

    customLogs(`----ADDING TRANSPORT----- || ${transport.id}`);
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

  async produce(socketID: string, produceTransportID: string, rtpParameters: RtpParameters, kind: MediaKind) {
    return new Promise(async (resolve, _) => {
      const producer = await this.peers[socketID].createProducer(produceTransportID, rtpParameters, kind);
      resolve(producer.id);
      this.brodCast(socketID, 'newProducers', [
        {
          producerId: producer.id,
          producerSocketID: socketID,
        },
      ]);
    });
  }

  brodCast(
    sockerID: string,
    eventName: string,
    data: Array<{ producerId: string; producerSocketID: string }>
  ) {
    for (let otherID of Array.from(Object.keys(this.peers)).filter(id => id !== sockerID)) {
      this.io.to(otherID).emit(eventName, data);
    }
  }

  async consume(
    socketID: string,
    consumerTransportID: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ) {
    if (!this.router.canConsume({ producerId: producerId, rtpCapabilities })) {
      console.error('Can not CONSUME');
      return;
    }

    const response = await this.peers[socketID].createConsumer(
      consumerTransportID,
      producerId,
      rtpCapabilities
    );
    response?.consumer.on('producerclose', () => {
      customLogs(`CONSUMER CLOSED (Due to produerclose event) || CONSUMER ID ${response?.consumer.id}`);
      this.peers[socketID].removeConsumer(response?.consumer.id);
      this.io.to(socketID).emit('consumerClosed', { consumerID: response?.consumer.id });
    });

    return response?.params;
  }

  async removePeer(socketID: string) {
    this.peers[socketID].close();
    delete this.peers[socketID];
  }

  async closeProducer(socketID: string, producerId: string) {
    this.peers[socketID].closeProducer(producerId);
  }

  getAllPeerInfo() {
    const peerList:
      | Array<{ id: string; name: string; isListener: boolean; isSpeaker: boolean; isAdmin: boolean }>
      | any = [];
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

  async becomeASpeaker(sockerID: string) {
    if (!this.peers[sockerID]) return;
    await this.peers[sockerID].speakerPermission();
  }

  getAdmin() {
    for (let peerKey in this.peers) {
      if (this.peers[peerKey].isAdmin) {
        return this.peers[peerKey];
      }
    }
    return null;
  }

  getPeer(peerID: string) {
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

export default Room;
