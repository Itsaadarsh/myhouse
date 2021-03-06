import { Device } from 'mediasoup-client';
import { Consumer } from 'mediasoup-client/lib/Consumer';
import { Producer } from 'mediasoup-client/lib/Producer';
import { Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { RtpCapabilities, RtpParameters } from 'mediasoup-client/lib/RtpParameters';
import { DtlsParameters } from 'mediasoup-client/lib/Transport';

const mediaType = {
  audio: 'audioType',
};
const _EVENTS = {
  exitRoom: 'exitRoom',
  startAudio: 'startAudio',
  stopAudio: 'stopAudio',
  defaultListener: 'defaultListener',
  defaultSpeaker: 'defaultSpeaker',
  disableSpeaker: 'disableSpeaker',
};

interface RESPONSE {
  msg: string;
  data: null | any;
  status: number;
}

class RoomClient {
  name: string;
  remoteAudioEl: HTMLAudioElement;
  socket: typeof Socket;
  roomID: string;
  producerTransport: null | Producer | any;
  consumerTransport: null | Consumer | any;
  device: null | Device;
  consumers: {
    [consumerID: string]: Consumer;
  };
  producers: {
    [producersID: string]: Producer;
  };
  producerLabel: {
    [type: string]: string;
  };
  _isOpen: boolean;
  eventListeners: any;
  constructor(
    remoteAudioEl: HTMLAudioElement,
    socket: typeof Socket,
    roomID: string,
    name: string,
    successCallback: any
  ) {
    this.name = name;
    this.remoteAudioEl = remoteAudioEl;

    this.socket = socket;
    this.producerTransport = null;
    this.consumerTransport = null;
    this.device = null;
    this.roomID = roomID;

    this.consumers = {};
    this.producers = {};

    /**
     * map that contains a mediatype as key and producerId as value
     */
    this.producerLabel = {};

    this._isOpen = false;
    this.eventListeners = {};
    Object.keys(_EVENTS).forEach(evt => {
      this.eventListeners[evt] = [];
    });

    this.createRoom(roomID).then(() => {
      setTimeout(async () => {
        this.join(name, roomID);
      }, 100);
      this._isOpen = true;
      successCallback();
    });
  }

  ////////// INIT /////////

  async createRoom(roomID: string) {
    try {
      await this.socket.emit('createRoom', {
        roomID,
      });
    } catch (err) {
      console.log(err);
    }
  }

  async join(name: string, roomID: string) {
    try {
      await this.socket.emit('join', { name, roomID });
      await this.socket.emit('getRouterRtpCapabilities');
      this.socket.on('getRouterRtpCapabilities', async (response: RESPONSE) => {
        this.socket.emit('getMyPeerInfo');
        console.log(response.data);
        let device = await this.loadDevice(response.data);
        this.device = device!;
        this.initSockets();
        this.initTransports(device!);
        await this.socket.on('getMyPeerInfo', async ({ data }: RESPONSE) => {
          console.log(data);
          if (data.peers[data.peers.length - 1].isListener) {
            this.event(_EVENTS.defaultListener);
          } else {
            await this.listenToSpeakerPermission();
          }
        });
        setTimeout(() => {
          this.socket.emit('getProducers');
        }, 1000);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async loadDevice(routerRtpCapabilities: RtpCapabilities) {
    let device;
    try {
      device = new mediasoupClient.Device();
    } catch (error) {
      if (error.name === 'UnsupportedError') {
        console.error('browser not supported');
      }
      console.error(error);
    }
    await device?.load({
      routerRtpCapabilities,
    });
    return device;
  }

  async initTransports(device: Device) {
    // init producerTransport
    {
      await this.socket.emit('createWebRtcProducerTransport');
      await this.socket.on('createWebRtcProducerTransport', async (response: RESPONSE) => {
        if (response.data === null) {
          console.error(response.msg);
          return;
        }

        this.producerTransport = device.createSendTransport(response.data);
        this.producerTransport!.on(
          'connect',
          async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: any, errback: any) => {
            try {
              await this.socket.emit('connectTransport', {
                dtlsParameters,
                transportID: response.data.id,
              });
              callback('Success');
            } catch (err) {
              errback(err);
            }
          }
        );

        this.producerTransport!.on(
          'produce',
          async (
            { kind, rtpParameters }: { kind: string; rtpParameters: RtpParameters },
            callback: any,
            errback: any
          ) => {
            try {
              await this.socket.emit('produce', {
                produceTransportID: this.producerTransport!.id,
                kind,
                rtpParameters,
              });

              this.socket.on('produce', (response: RESPONSE) => {
                const { producerId } = response.data;
                if (response.data === null) return;
                else {
                  callback({
                    id: producerId,
                  });
                }
              });
            } catch (err) {
              errback(err);
            }
          }
        );

        this.producerTransport!.on('connectionstatechange', (state: any) => {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              break;

            case 'failed':
              this.producerTransport!.close();
              break;

            default:
              break;
          }
        });
      });
    }

    // init consumerTransport
    {
      await this.socket.emit('createWebRtcConsumerTransport');
      this.socket.on('createWebRtcConsumerTransport', async (response: RESPONSE) => {
        if (response.data === null) {
          console.error(response.msg);
          return;
        }
        // only one needed
        this.consumerTransport = device.createRecvTransport(response.data);
        console.log(this.consumerTransport!.id);
        this.consumerTransport!.on(
          'connect',
          async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback: any, errback: any) => {
            try {
              await this.socket.emit('connectTransport', {
                transportID: this.consumerTransport!.id,
                dtlsParameters,
              });
              callback('Success');
            } catch (err) {
              errback(err);
            }
          }
        );

        this.consumerTransport!.on('connectionstatechange', async (state: any) => {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              break;

            case 'failed':
              this.consumerTransport!.close();
              break;

            default:
              break;
          }
        });
      });
    }
  }

  initSockets() {
    this.socket.on('consumerClosed', ({ consumerID }: { consumerID: string }) => {
      console.log('closing consumer:', consumerID);
      this.removeConsumer(consumerID);
    });

    this.socket.on('newProducers', async (data: Array<{ producerId: string }>) => {
      console.log('new producers', data);
      for (let { producerId } of data) {
        await this.getConsumeStream(producerId);
      }
    });

    this.socket.on('disconnect', () => {
      this.exit(true);
    });
  }

  //////// MAIN FUNCTIONS /////////////

  async produce(type: string, deviceId = null) {
    let mediaConstraints = {};
    let audio = false;
    switch (type) {
      case mediaType.audio:
        mediaConstraints = {
          audio: {
            deviceId: deviceId,
          },
          video: false,
        };
        audio = true;
        break;
    }

    if (this.producerLabel[type]) {
      console.log('producer already exists for this type ' + type);
      return;
    }
    console.log('mediacontraints:', mediaConstraints);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      console.log(navigator.mediaDevices.getSupportedConstraints());

      const track = stream.getAudioTracks()[0];
      const params = {
        track,
      };

      const producer = await this.producerTransport!.produce(params);
      console.log('producer', producer);

      this.producers[producer.id] = producer;

      let elem: any;

      producer.on('trackended', () => {
        this.closeProducer(type);
      });

      producer.on('transportclose', () => {
        console.log('producer transport close');
        if (!audio) {
          elem.srcObject.getTracks().forEach(function (track: any) {
            track.stop();
          });
          elem.parentNode.removeChild(elem);
        }
        delete this.producers[producer.id];
      });

      producer.on('close', () => {
        console.log('closing producer');
        if (!audio) {
          elem.srcObject.getTracks().forEach(function (track: any) {
            track.stop();
          });
          elem.parentNode.removeChild(elem);
        }
        delete this.producers[producer.id];
      });

      this.producerLabel[type] = producer.id;

      switch (type) {
        case mediaType.audio:
          this.event(_EVENTS.startAudio);
          break;
      }
    } catch (err) {
      console.log(err);
    }
  }

  async consume(consumer: Consumer, stream: any) {
    this.consumers[consumer.id] = consumer;
    let elem;
    elem = document.createElement('audio');
    elem.srcObject = stream;
    elem.id = consumer.id;
    elem.autoplay = true;
    this.remoteAudioEl.appendChild(elem);
    consumer.on('trackended', () => {
      this.removeConsumer(consumer.id);
    });
    consumer.on('transportclose', () => {
      this.removeConsumer(consumer.id);
    });
  }

  async getConsumeStream(producerId: string) {
    const { rtpCapabilities } = this.device!;
    this.socket.emit('consume', {
      rtpCapabilities,
      consumerTransportID: this.consumerTransport!.id, // might be
      producerId: producerId,
    });

    await this.socket.on('consume', async (response: RESPONSE) => {
      const { id, kind, rtpParameters } = response.data;
      let codecOptions = {};
      const consumer = await this.consumerTransport!.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
      });
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      this.consume(consumer, stream);
    });
  }

  async listenToSpeakerPermission() {
    await this.socket.on(
      'speakerPermission',
      async ({
        peerData,
      }: {
        peerData: {
          id: string;
          name: string;
        };
      }) => {
        if (confirm(`${peerData.name} wants to be a speaker`)) {
          this.socket.emit('speakerPermissionAccepted', {
            socketID: peerData.id,
          });
        }
      }
    );
  }

  async beASpeaker() {
    await this.socket.emit('beASpeaker');
    this.socket.on(
      'speakerAccepted',
      async ({
        peerData,
      }: {
        peerData: {
          id: string;
          name: string;
        };
      }) => {
        if (peerData) {
          this.event(_EVENTS.defaultSpeaker);
        } else {
          this.event(_EVENTS.defaultListener);
        }
      }
    );
    this.event(_EVENTS.disableSpeaker);
  }

  closeProducer(type: string) {
    if (!this.producerLabel[type]) {
      console.log('there is no producer for this type ' + type);
      return;
    }
    let producerId = this.producerLabel[type];
    this.socket.emit('producerClosed', {
      producerId,
    });

    this.producers[producerId].close();
    delete this.producers[producerId];
    delete this.producerLabel[type];

    switch (type) {
      case mediaType.audio:
        this.event(_EVENTS.stopAudio);
        break;
    }
  }

  pauseProducer(type: string) {
    if (!this.producerLabel[type]) {
      console.log('there is no producer for this type ' + type);
      return;
    }
    let producerId = this.producerLabel[type];
    this.producers[producerId].pause();
  }

  resumeProducer(type: string) {
    if (!this.producerLabel[type]) {
      console.log('there is no producer for this type ' + type);
      return;
    }
    let producerId = this.producerLabel[type];
    this.producers[producerId].resume();
  }

  removeConsumer(consumerID: string) {
    let elem: any = document.getElementById(consumerID);
    elem.srcObject!.getTracks().forEach(function (track: any) {
      track.stop();
    });
    elem.parentNode.removeChild(elem);

    delete this.consumers[consumerID];
  }

  async exit(offline = false) {
    let clean = () => {
      this._isOpen = false;
      this.consumerTransport!.close();
      this.producerTransport!.close();
      this.socket.off('disconnect');
      this.socket.off('newProducers');
      this.socket.off('consumerClosed');
    };

    if (!offline) {
      await this.socket.emit('exitRoom');
      clean();
    } else {
      clean();
    }

    this.event(_EVENTS.exitRoom);
  }

  ///////  HELPERS //////////
  static get mediaType() {
    return mediaType;
  }

  event(evt: string) {
    if (this.eventListeners[evt]) {
      this.eventListeners[evt].forEach((callback: any) => callback());
    }
  }

  on(evt: string, callback: any) {
    this.eventListeners[evt].push(callback);
  }

  //////// GETTERS ////////

  isOpen() {
    return this._isOpen;
  }

  static get EVENTS() {
    return _EVENTS;
  }
}
