import { Router, Worker } from 'mediasoup/lib/types';
import config from './config';
import { PEER, PEERTYPE, ROOM } from './types/allRooms.types.';

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

  addPeer(peer: PEER) {
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
}

export default Room;
