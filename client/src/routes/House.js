import React, { useEffect, useRef } from 'react';
import io from 'socket.io-client';

const House = props => {
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();

  useEffect(() => {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true})
      userVideo.current.srcObject = stream;
      userStream.current = stream;

      socketRef.current = io.connect('/');
      socketRef.current.emit('join', props.match.params.houseID)

      socketRef.current.on('secondUser', userID => {
          callUser(userID);
          otherUser.current = userID;
      })

      socketRef.current.on('userJoined', userID => {
        otherUser.current = userID;
    })

    socketRef.current.on('offer', handleRecieveCall);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleNewICEcandidateMSG);



    }, [])

    const callUser = (userID) => {
        peerRef.current = createPeer(userID);
        userStream.current.getTracks().foreach(track => peerRef.current.addTrack(track, userStream.current))
    }

    const createPeer = (userID) => {
        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: 'stun:stun.stunprotocol.org'
                },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                }
            ]
        })
        peer.onicecandidate = handleNewICEcandidateEvent;
        peer.ontrack = handleTrackEvent;
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID)
    }
  return (
    <>
      <video autoPlay ref={userVideo}></video>
      <video autoPlay ref={partnerVideo}></video>
    </>
  );
};

export default House;
