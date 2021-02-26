window.onload = () => {
  document.getElementById('my-button').onclick = () => {
    init();
  };
};

const init = async () => {
  const peer = createPeer();
  peer.addTransceiver('video', { direction: 'recvonly' });
};

const createPeer = () => {
  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.stunprotocol.org',
      },
    ],
  });
  peer.ontrack = handleTrack;
  peer.onnegotiationneeded = () => handleNegotiation(peer);

  return peer;
};

const handleNegotiation = async peer => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  const payload = {
    sdp: peer.localDescription,
  };

  const { data } = await axios.post('/consumer', payload);
  const desc = new RTCSessionDescription(data.sdp);
  peer.setRemoteDescription(desc).catch(e => console.log(e));
};

const handleTrack = e => {
  document.getElementById('video').srcObject = e.streams[0];
};
