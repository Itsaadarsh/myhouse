import {
  Consumer,
  DtlsParameters,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpParameters,
  Transport,
} from 'mediasoup/lib/types';
import { PEER } from './types/allRooms.types.';
import customLogs from './utils/customConsoleLogs';

class Peer implements PEER {
  readonly id: string;
  readonly name: string;
  isSpeaker: boolean;
  isListener: boolean;
  readonly transports: {
    [transportID: string]: Transport;
  };
  readonly consumers: {
    [consumerID: string]: Consumer;
  };
  readonly producers: {
    [producerId: string]: Producer;
  };
  constructor(socketID: string, name: string, creatorBool: boolean) {
    (this.id = socketID),
      (this.name = name),
      (this.transports = {}),
      (this.consumers = {}),
      (this.producers = {});
    if (creatorBool) {
      this.isSpeaker = true;
      this.isListener = false;
    } else {
      this.isListener = true;
      this.isSpeaker = false;
    }
  }

  addTransport(transport: Transport) {
    this.transports[transport.id] = transport;
  }

  async connectTransport(transportID: string, dtlsParameters: DtlsParameters) {
    if (!this.transports[transportID]) return;
    await this.transports[transportID].connect({ dtlsParameters });
  }

  async createProducer(produceTransportID: string, rtpParameters: RtpParameters, kind: MediaKind) {
    const producer = await this.transports[produceTransportID].produce({ kind, rtpParameters });
    this.producers[producer.id] = producer;

    producer.on('transportclose', () => {
      customLogs(`PRODUCER TRANSPORT CLOSE || CONSUMER ID : ${producer.id}`);
      producer.close();
      delete this.producers[producer.id];
    });

    return producer;
  }

  async createConsumer(consumerTransportID: string, producerId: string, rtpCapabilities: RtpCapabilities) {
    const consumerTransport = this.transports[consumerTransportID];
    let consumer: Consumer | null = null;

    try {
      consumer = await consumerTransport.consume({
        producerId: producerId,
        rtpCapabilities,
        paused: false,
      });
    } catch (err) {
      console.error('Consuming Failed', err);
      return;
    }
    if (consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({
        spatialLayer: 2,
        temporalLayer: 2,
      });
    }

    this.consumers[consumer.id] = consumer;

    consumer.on('transportclose', () => {
      customLogs(`CONSUMER TRANSPORT CLOSE || CONSUMER ID : ${consumer!.id}`);
      delete this.consumers[consumer!.id];
    });

    return {
      consumer,
      params: {
        producerId: producerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      },
    };
  }

  removeConsumer(consumerID: string) {
    delete this.consumers[consumerID];
  }

  close() {
    for (let transport in this.transports) {
      this.transports[transport].close();
    }
  }

  closeProducer(producerId: string) {
    try {
      this.producers[producerId].close();
    } catch (err) {
      console.warn(err);
    }
    delete this.producers[producerId];
  }

  speakerPermission() {
    (this.isListener = false), (this.isSpeaker = true);
  }
}

export default Peer;
