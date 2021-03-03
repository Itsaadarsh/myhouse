const mediaType = {
  audio: 'audioType',
  video: 'videoType',
  screen: 'screenType',
};
const _EVENTS = {
  exitRoom: 'exitRoom',
  openRoom: 'openRoom',
  startVideo: 'startVideo',
  stopVideo: 'stopVideo',
  startAudio: 'startAudio',
  stopAudio: 'stopAudio',
  startScreen: 'startScreen',
  stopScreen: 'stopScreen',
};

class RoomClient {
  constructor(
    localMediaEl,
    remoteVideoEl,
    remoteAudioEl,
    mediasoupClient,
    socket,
    roomID,
    name,
    successCallback
  ) {
    this.name = name;
    this.localMediaEl = localMediaEl;
    this.remoteVideoEl = remoteVideoEl;
    this.remoteAudioEl = remoteAudioEl;
    this.mediasoupClient = mediasoupClient;

    this.socket = socket;
    this.producerTransport = null;
    this.consumerTransport = null;
    this.device = null;
    this.roomID = roomID;

    this.consumers = new Map();
    this.producers = new Map();

    /**
     * map that contains a mediatype as key and producerId as value
     */
    this.producerLabel = new Map();

    this._isOpen = false;
    this.eventListeners = new Map();
    Object.keys(_EVENTS).forEach(
      function (evt) {
        this.eventListeners.set(evt, []);
      }.bind(this)
    );

    this.createRoom(roomID).then(
      async function () {
        await this.join(name, roomID);
        this.initSockets();
        this._isOpen = true;
        successCallback();
      }.bind(this)
    );
  }

  ////////// INIT /////////

  async createRoom(roomID) {
    await this.socket
      .request('createRoom', {
        roomID,
      })
      .catch(err => {
        console.log(err);
      });
  }

  async join(name, roomID) {
    socket
      .request('join', {
        name,
        roomID,
      })
      .then(
        async function (e) {
          const data = await this.socket.request('getRouterRtpCapabilities');
          let device = await this.loadDevice(data);
          this.device = device;
          await this.initTransports(device);
          this.socket.emit('getProducers');
        }.bind(this)
      )
      .catch(e => {
        console.log(e);
      });
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
      const data = await this.socket.request('createWebRtcTransport', {
        forceTcp: false,
        rtpCapabilities: device.rtpCapabilities,
      });
      if (data.error) {
        console.error(data.error);
        return;
      }

      this.producerTransport = device.createSendTransport(data);

      this.producerTransport.on(
        'connect',
        async function ({ dtlsParameters }, callback, errback) {
          this.socket
            .request('connectTransport', {
              dtlsParameters,
              transportID: data.id,
            })
            .then(callback)
            .catch(errback);
        }.bind(this)
      );

      this.producerTransport.on(
        'produce',
        async function ({ kind, rtpParameters }, callback, errback) {
          try {
            const { producerId } = await this.socket.request('produce', {
              produceTransportID: this.producerTransport.id,
              kind,
              rtpParameters,
            });
            callback({
              id: producerId,
            });
          } catch (err) {
            errback(err);
          }
        }.bind(this)
      );

      this.producerTransport.on(
        'connectionstatechange',
        function (state) {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              //localVideo.srcObject = stream
              break;

            case 'failed':
              this.producerTransport.close();
              break;

            default:
              break;
          }
        }.bind(this)
      );
    }

    // init consumerTransport
    {
      const data = await this.socket.request('createWebRtcTransport', {
        forceTcp: false,
      });
      if (data.error) {
        console.error(data.error);
        return;
      }

      // only one needed
      this.consumerTransport = device.createRecvTransport(data);
      this.consumerTransport.on(
        'connect',
        function ({ dtlsParameters }, callback, errback) {
          this.socket
            .request('connectTransport', {
              transportID: this.consumerTransport.id,
              dtlsParameters,
            })
            .then(callback)
            .catch(errback);
        }.bind(this)
      );

      this.consumerTransport.on(
        'connectionstatechange',
        async function (state) {
          switch (state) {
            case 'connecting':
              break;

            case 'connected':
              //remoteVideo.srcObject = await stream;
              //await socket.request('resume');
              break;

            case 'failed':
              this.consumerTransport.close();
              break;

            default:
              break;
          }
        }.bind(this)
      );
    }
  }

  initSockets() {
    this.socket.on(
      'consumerClosed',
      function ({ consumerID }) {
        console.log('closing consumer:', consumerID);
        this.removeConsumer(consumerID);
      }.bind(this)
    );

    /**
     * data: [ {
     *  producerId:
     *  producer_socket_id:
     * }]
     */
    this.socket.on(
      'newProducers',
      async function (data) {
        console.log('new producers', data);
        for (let { producerId } of data) {
          await this.consume(producerId);
        }
      }.bind(this)
    );

    this.socket.on(
      'disconnect',
      function () {
        this.exit(true);
      }.bind(this)
    );
  }

  //////// MAIN FUNCTIONS /////////////

  async produce(type, deviceId = null) {
    let mediaConstraints = {};
    let audio = false;
    let screen = false;
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
      case mediaType.video:
        mediaConstraints = {
          audio: false,
          video: {
            width: {
              min: 640,
              ideal: 1920,
            },
            height: {
              min: 400,
              ideal: 1080,
            },
            deviceId: deviceId,
            /*aspectRatio: {
                            ideal: 1.7777777778
                        }*/
          },
        };
        break;
      case mediaType.screen:
        mediaConstraints = false;
        screen = true;
        break;
      default:
        return;
        break;
    }
    if (!this.device.canProduce('video') && !audio) {
      console.error('cannot produce video');
      return;
    }
    if (this.producerLabel.has(type)) {
      console.log('producer already exists for this type ' + type);
      return;
    }
    console.log('mediacontraints:', mediaConstraints);
    let stream;
    try {
      stream = screen
        ? await navigator.mediaDevices.getDisplayMedia()
        : await navigator.mediaDevices.getUserMedia(mediaConstraints);
      console.log(navigator.mediaDevices.getSupportedConstraints());

      const track = audio ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
      const params = {
        track,
      };
      if (!audio && !screen) {
        params.encodings = [
          {
            rid: 'r0',
            maxBitrate: 100000,
            //scaleResolutionDownBy: 10.0,
            scalabilityMode: 'S1T3',
          },
          {
            rid: 'r1',
            maxBitrate: 300000,
            scalabilityMode: 'S1T3',
          },
          {
            rid: 'r2',
            maxBitrate: 900000,
            scalabilityMode: 'S1T3',
          },
        ];
        params.codecOptions = {
          videoGoogleStartBitrate: 1000,
        };
      }
      producer = await this.producerTransport.produce(params);

      console.log('producer', producer);

      this.producers.set(producer.id, producer);

      let elem;
      if (!audio) {
        elem = document.createElement('video');
        elem.srcObject = stream;
        elem.id = producer.id;
        elem.playsinline = false;
        elem.autoplay = true;
        elem.className = 'vid';
        this.localMediaEl.appendChild(elem);
      }

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
        case mediaType.video:
          this.event(_EVENTS.startVideo);
          break;
        case mediaType.screen:
          this.event(_EVENTS.startScreen);
          break;
        default:
          return;
          break;
      }
    } catch (err) {
      console.log(err);
    }
  }

  async consume(producerId) {
    //let info = await roomInfo()
    this.getConsumeStream(producerId).then(
      function ({ consumer, stream, kind }) {
        this.consumers.set(consumer.id, consumer);
        let elem;
        if (kind === 'video') {
          elem = document.createElement('video');
          elem.srcObject = stream;
          elem.id = consumer.id;
          elem.playsinline = false;
          elem.autoplay = true;
          elem.className = 'vid';
          console.log(elem);
          this.remoteVideoEl.appendChild(elem);
        } else {
          elem = document.createElement('audio');
          elem.srcObject = stream;
          elem.id = consumer.id;
          elem.playsinline = false;
          elem.autoplay = true;
          this.remoteAudioEl.appendChild(elem);
        }
        consumer.on(
          'trackended',
          function () {
            this.removeConsumer(consumer.id);
          }.bind(this)
        );
        consumer.on(
          'transportclose',
          function () {
            this.removeConsumer(consumer.id);
          }.bind(this)
        );
      }.bind(this)
    );
  }

  async getConsumeStream(producerId) {
    const { rtpCapabilities } = this.device;
    const data = await this.socket.request('consume', {
      rtpCapabilities,
      consumerTransportID: this.consumerTransport.id, // might be
      producerId: producerId,
    });
    const { id, kind, rtpParameters } = data;

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

    return {
      consumer,
      stream,
      kind,
    };
  }

  closeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log('there is no producer for this type ' + type);
      return;
    }
    let producerId = this.producerLabel.get(type);
    console.log(producerId);
    this.socket.emit('producerClosed', {
      producerId,
    });
    this.producers.get(producerId).close();
    this.producers.delete(producerId);
    this.producerLabel.delete(type);

    if (type !== mediaType.audio) {
      let elem = document.getElementById(producerId);
      elem.srcObject.getTracks().forEach(function (track) {
        track.stop();
      });
      elem.parentNode.removeChild(elem);
    }

    switch (type) {
      case mediaType.audio:
        this.event(_EVENTS.stopAudio);
        break;
      case mediaType.video:
        this.event(_EVENTS.stopVideo);
        break;
      case mediaType.screen:
        this.event(_EVENTS.stopScreen);
        break;
      default:
        return;
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

  exit(offline = false) {
    let clean = function () {
      this._isOpen = false;
      this.consumerTransport.close();
      this.producerTransport.close();
      this.socket.off('disconnect');
      this.socket.off('newProducers');
      this.socket.off('consumerClosed');
    }.bind(this);

    if (!offline) {
      this.socket
        .request('exitRoom')
        .then(e => console.log(e))
        .catch(e => console.warn(e))
        .finally(
          function () {
            clean();
          }.bind(this)
        );
    } else {
      clean();
    }

    this.event(_EVENTS.exitRoom);
  }

  ///////  HELPERS //////////

  async roomInfo() {
    let info = await socket.request('getMyRoomInfo');
    return info;
  }

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
