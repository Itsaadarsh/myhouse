import { Consumer, DtlsParameters, Producer, Transport } from 'mediasoup/lib/types';
import { PEER } from './types/allRooms.types.';

class Peer implements PEER {
  readonly id: string;
  readonly name: string;
  readonly transports: {
    [transportID: string]: Transport;
  };
  readonly consumers: {
    [consumerID: string]: Consumer;
  };
  readonly producers: {
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

  async connectTransport(transportID: string, dtlsParameters: DtlsParameters) {
    if (!this.transports[transportID]) return;
    await this.transports[transportID].connect({ dtlsParameters });
  }
}

export default Peer;
