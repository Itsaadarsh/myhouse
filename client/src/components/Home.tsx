import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import RoomClient from '../utils/RoomClient';
import CreateRoomPopup from './CreateRoomPopup';

const socket = io('http://localhost:4000/', { transports: ['websocket', 'polling', 'flashsocket'] });

function Home() {
  useEffect(() => {
    // new RoomClient()
  });

  const togglePopup = () => {
    // socket.on('')
  };

  return (
    <React.Fragment>
      <h1>myHouse</h1>
      <ul>
        <li>room 1</li>
        <li>room 2</li>
        <li>room 3</li>
      </ul>
      <input type='button' value='Create Room' onClick={togglePopup} />
      {isOpen && <CreateRoomPopup />}
    </React.Fragment>
  );
}

export default Home;
