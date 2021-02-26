const express = require('express');
const bodyParser = require('body-parser');
const webrtc = require('wrtc');

const app = express();
let senderStream;

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/brodcast', async (req, res) => {
  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.stunprotocol.org',
      },
    ],
  });

  peer.ontrack = e => handleTrackEvent(e, peer);
  const desc = new webrtc.RTCSessionDescription(req.body.sdp);
  await peer.setRemoteDescription(desc);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  const payload = {
    sdp: peer.localDescription,
  };
  res.json(payload);
});

app.post('/consumer', async (req, res) => {
  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.stunprotocol.org',
      },
    ],
  });

  const desc = new webrtc.RTCSessionDescription(req.body.sdp);
  await peer.setRemoteDescription(desc);

  // Sending server stream to the consumer
  senderStream.getTracks().forEach(track => peer.addTrack(track, senderStream));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  const payload = {
    sdp: peer.localDescription,
  };
  res.json(payload);
});

const handleTrackEvent = (e, peer) => {
  senderStream = e.streams[0];
};

app.listen(5000, () => {
  console.log('Server Started');
});
