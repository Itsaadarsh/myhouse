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

class RoomClient {
  constructor(remoteAudioEl, mediasoupClient, socket, roomID, name, successCallback) {
    this.name = name;
    this.remoteAudioEl = remoteAudioEl;
    this.mediasoupClient = mediasoupClient;

    this.socket = socket;
    this.producerTransport = null;
    this.consumerTransport = null;
    this.device = null;
    this.roomID = roomID;
    this.peerMap = new Map();
    this.consumers = new Map();
    this.producers = new Map();
    this.producerLabel = new Map();
    this.eventListeners = new Map();

    this._isOpen = false;
    Object.keys(_EVENTS).forEach(evt => {
      this.eventListeners.set(evt, []);
    });

    this.createRoom(roomID).then(() => {
      setTimeout(async () => {
        this.join(name, roomID);
      }, 100);
      this._isOpen = true;
      successCallback();
    });
  }

  async getAllRooms() {
    try {
      this.socket.emit('getAllOpenRooms');
      await this.socket.on('getAllOpenRooms', async response => {});
    } catch (err) {
      console.log(err);
    }
  }

  async createRoom(roomID) {
    try {
      await this.socket.emit('createRoom', {
        roomID,
      });
    } catch (err) {
      console.log(err);
    }
  }

  async join(name, roomID) {
    try {
      await this.socket.emit('join', { name, roomID });
      await this.socket.emit('getRouterRtpCapabilities');
      this.socket.on('getRouterRtpCapabilities', async response => {
        this.socket.emit('getMyPeerInfo');
        this.initSockets();
        let device = await this.loadDevice(response.data);
        this.device = device;
        this.initTransports(device);
        setTimeout(async () => {
          const obj = Object.fromEntries(this.peerMap);
          const isPeerListener = obj[Object.keys(obj)[Object.keys(obj).length - 1]].isListener;
          if (isPeerListener) {
            this.event(_EVENTS.defaultListener);
          } else {
            this.event(_EVENTS.defaultSpeaker);
            await this.listenToSpeakerPermission();
          }
          this.socket.emit('getProducers');
        }, 500);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async displayPeers() {
    let speakerList = document.createElement('ul');
    speakerList.innerHTML = 'Speaker';
    speakerList.id = 'speaker';
    let listenerList = document.createElement('ul');
    listenerList.innerHTML = 'Listener';
    listenerList.id = 'listener';
    this.peerMap.forEach(peer => {
      let li = document.createElement('li');
      if (peer.isSpeaker) {
        console.log('render');
        li.innerHTML = peer.name;
        speakerList.appendChild(li);
      } else if (peer.isListener) {
        li.innerHTML = peer.name;
        listenerList.appendChild(li);
      }
    });
    this.remoteAudioEl.appendChild(speakerList);
    this.remoteAudioEl.appendChild(listenerList);
  }

  async loadDevice(routerRtpCapabilities) {
    let device;
    try {
      device = new this.mediasoupClient.Device();
    } catch (error) {
      if (error.name === 'UnsupportedError') {
        console.error('browser not supported');
      }
      console.error(error);
    }
    await device.load({
      routerRtpCapabilities,
    });
    return device;
  }

  async initTransports(device) {
    // init producerTransport
    {
      await this.socket.emit('createWebRtcProducerTransport');
      await this.socket.on('createWebRtcProducerTransport', async response => {
        if (response.data === null) {
          console.error(response.msg);
          return;
        }

        this.producerTransport = device.createSendTransport(response.data);
        this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await this.socket.emit('connectTransport', {
              dtlsParameters,
              transportID: response.data.id,
            });
            callback('Success');
          } catch (err) {
            errback(err);
          }
        });

        this.producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            await this.socket.emit('produce', {
              produceTransportID: this.producerTransport.id,
              kind,
              rtpParameters,
            });

            this.socket.on('produce', response => {
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
        });

        this.producerTransport.on('connectionstatechange', state => {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              break;

            case 'failed':
              this.producerTransport.close();
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
      this.socket.on('createWebRtcConsumerTransport', async response => {
        if (response.data === null) {
          console.error(response.msg);
          return;
        }
        // only one needed
        this.consumerTransport = device.createRecvTransport(response.data);
        console.log(this.consumerTransport.id);
        this.consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await this.socket.emit('connectTransport', {
              transportID: this.consumerTransport.id,
              dtlsParameters,
            });
            callback('Success');
          } catch (err) {
            errback(err);
          }
        });

        this.consumerTransport.on('connectionstatechange', async state => {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              break;

            case 'failed':
              this.consumerTransport.close();
              break;

            default:
              break;
          }
        });
      });
    }
  }

  initSockets() {
    this.socket.on('consumerClosed', ({ consumerID }) => {
      console.log('closing consumer:', consumerID);
      this.removeConsumer(consumerID);
    });

    this.socket.on('newProducers', async data => {
      console.log('new producers', data);
      for (let { producerId } of data) {
        await this.getConsumeStream(producerId);
      }
    });

    this.socket.on('getMyPeerInfo', async ({ data }) => {
      data.peers.forEach(peer => {
        this.peerMap.set(peer.id, peer);
      });
      while (document.getElementById('remoteAudios').hasChildNodes()) {
        document
          .getElementById('remoteAudios')
          .removeChild(document.getElementById('remoteAudios').firstChild);
      }
      this.displayPeers();
    });

    this.socket.on('disconnect', () => {
      this.exit(true);
    });
  }

  //////// MAIN FUNCTIONS /////////////

  async produce(type, deviceId = null) {
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

    if (this.producerLabel.has(type)) {
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

      producer = await this.producerTransport.produce(params);
      console.log('producer', producer);

      this.producers.set(producer.id, producer);

      let elem;

      producer.on('trackended', () => {
        this.closeProducer(type);
      });

      producer.on('transportclose', () => {
        console.log('producer transport close');
        if (!audio) {
          elem.srcObject.getTracks().forEach(function (track) {
            track.stop();
          });
          elem.parentNode.removeChild(elem);
        }
        this.producers.delete(producer.id);
      });

      producer.on('close', () => {
        console.log('closing producer');
        if (!audio) {
          elem.srcObject.getTracks().forEach(function (track) {
            track.stop();
          });
          elem.parentNode.removeChild(elem);
        }
        this.producers.delete(producer.id);
      });

      this.producerLabel.set(type, producer.id);

      switch (type) {
        case mediaType.audio:
          this.event(_EVENTS.startAudio);
          break;
      }
    } catch (err) {
      console.log(err);
    }
  }

  async consume(consumer, stream, kind) {
    this.consumers.set(consumer.id, consumer);
    let elem;
    elem = document.createElement('audio');
    elem.srcObject = stream;
    elem.id = consumer.id;
    elem.autoplay = true;
    console.log(elem);
    this.remoteAudioEl.appendChild(elem);
    consumer.on('trackended', () => {
      this.removeConsumer(consumer.id);
    });
    consumer.on('transportclose', () => {
      this.removeConsumer(consumer.id);
    });
  }

  async getConsumeStream(producerId) {
    const { rtpCapabilities } = this.device;
    this.socket.emit('consume', {
      rtpCapabilities,
      consumerTransportID: this.consumerTransport.id, // might be
      producerId: producerId,
    });

    await this.socket.on('consume', async response => {
      const { id, kind, rtpParameters } = response.data;
      let codecOptions = {};
      const consumer = await this.consumerTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
      });
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      this.consume(consumer, stream, kind);
    });
  }

  async listenToSpeakerPermission() {
    await this.socket.on('speakerPermission', async ({ peerData }) => {
      const dialogBoxConfig = swal(`${peerData.name} wants to be a speaker`, {
        buttons: {
          cancel: {
            text: 'Decline',
            value: false,
            visible: true,
            className: '',
            closeModal: true,
          },
          confirm: {
            text: 'Accept',
            value: true,
            visible: true,
            className: '',
            closeModal: true,
          },
        },
      });

      if (await dialogBoxConfig) {
        this.socket.emit('speakerPermissionAccepted', {
          socketID: peerData.id,
        });
      }
    });
  }

  async beASpeaker() {
    await this.socket.emit('beASpeaker');
    this.socket.on('speakerAccepted', async ({ peerData }) => {
      if (peerData) {
        this.event(_EVENTS.defaultSpeaker);
      } else {
        this.event(_EVENTS.defaultListener);
      }
    });
    this.event(_EVENTS.disableSpeaker);
  }

  closeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log('there is no producer for this type ' + type);
      return;
    }
    let producerId = this.producerLabel.get(type);
    this.socket.emit('producerClosed', {
      producerId,
    });

    this.producers.get(producerId).close();
    this.producers.delete(producerId);
    this.producerLabel.delete(type);

    switch (type) {
      case mediaType.audio:
        this.event(_EVENTS.stopAudio);
        break;
    }
  }

  pauseProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log('there is no producer for this type ' + type);
      return;
    }
    let producerId = this.producerLabel.get(type);
    this.producers.get(producerId).pause();
  }

  resumeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log('there is no producer for this type ' + type);
      return;
    }
    let producerId = this.producerLabel.get(type);
    this.producers.get(producerId).resume();
  }

  removeConsumer(consumerID) {
    let elem = document.getElementById(consumerID);
    elem.srcObject.getTracks().forEach(function (track) {
      track.stop();
    });
    elem.parentNode.removeChild(elem);

    this.consumers.delete(consumerID);
  }

  async exit(offline = false) {
    let clean = () => {
      this._isOpen = false;
      this.consumerTransport.close();
      this.producerTransport.close();
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
    location.reload();
  }

  ///////  HELPERS //////////
  static get mediaType() {
    return mediaType;
  }

  event(evt) {
    if (this.eventListeners.has(evt)) {
      this.eventListeners.get(evt).forEach(callback => callback());
    }
  }

  on(evt, callback) {
    this.eventListeners.get(evt).push(callback);
  }

  //////// GETTERS ////////

  isOpen() {
    return this._isOpen;
  }

  static get EVENTS() {
    return _EVENTS;
  }
}
