window.onload = () => {
  document.getElementById('my-button').onclick = () => {
    init();
  };
};

const init = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  document.getElementById('video').srcObject = stream;
  const peer = createPeer();
  stream.getTracks().forEach(track => peer.addTrack(track, stream));
};

const createPeer = () => {
  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.stunprotocol.org',
      },
    ],
  });
  peer.onnegotiationneeded = () => handleNegotiation(peer);

  return peer;
};

const handleNegotiation = async peer => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  const payload = {
    sdp: peer.localDescription,
  };

  const { data } = await axios.post('/brodcast', payload);
  const desc = new RTCSessionDescription(data.sdp);
  peer.setRemoteDescription(desc).catch(e => console.log(e));
};
