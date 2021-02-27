import { Router } from 'mediasoup/lib/types';

export default interface ALLROOMS {
  [roomID: string]: ROOM;
}

export interface ROOM {
  id: string;
  router?: Router;
  peers: PEERTYPE;
}

export type PEERTYPE = {
  [peerID: string]: PEER;
};

export interface PEER {
  id: string;
  name: string;
  master: boolean;
}
