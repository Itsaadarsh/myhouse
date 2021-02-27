import { Router, Worker } from 'mediasoup/lib/types';
import config from './config';
import { PEER } from './types/allRooms.types.';

class Room {
  id: string;
  router: Router;
  peers: Map<string, PEER>;
  io: any;

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

    this.peers = new Map<string, PEER>();
    this.io = io;
  }
}

export default module.exports = Room;
