import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import CreateRoomPopup from './CreateRoomPopup';

const socket = io('http://localhost:4000/', { transports: ['websocket', 'polling', 'flashsocket'] });

function Home() {
  const [isOpen, setIsOpen] = useState(false);

  const togglePopup = () => {
    setIsOpen(!isOpen);
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
