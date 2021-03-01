import { Consumer, Producer, Transport } from 'mediasoup/lib/types';
import { PEER } from './types/allRooms.types.';

class Peer implements PEER {
  id: string;
  name: string;
  transports: {
    [transportID: string]: Transport;
  };
  consumers: {
    [consumerID: string]: Consumer;
  };
  producers: {
    [producerID: string]: Producer;
  };
  constructor(socketID: string, name: string) {
    (this.id = socketID),
      (this.name = name),
      (this.transports = {}),
      (this.consumers = {}),
      (this.producers = {});
  }

  addTransport(transport: Transport) {
    this.transports[transport.id] = transport;
  }
}

export default Peer;
