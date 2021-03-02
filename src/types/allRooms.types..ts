import { Consumer, Producer, Router, Transport } from 'mediasoup/lib/types';
import Peer from 'src/Peer';
import Room from '../Room';

export default interface ALLROOMS {
  [roomID: string]: Room;
}

export interface ROOM {
  id: string;
  router?: Router;
  peers: PEERTYPE;
}

export type PEERTYPE = {
  [peerID: string]: Peer;
};

export interface PEER {
  id: string;
  name: string;
  transports: {
    [transportID: string]: Transport;
  };
  consumers: {
    [consumerID: string]: Consumer;
  };
  producers: {
    [producerId: string]: Producer;
  };
}
