import React, { useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000/', { transports: ['websocket', 'polling', 'flashsocket'] });

function App() {
  useEffect(() => {
    socket.emit('welcome');
    socket.on('welcome', (data: any) => {
      console.log(data);
    });
  });

  return (
    <React.Fragment>
      <h1>myHouse</h1>
      <ul>
        <li>room 1</li>
        <li>room 2</li>
        <li>room 3</li>
      </ul>
      <button>Create a room</button>
    </React.Fragment>
  );
}

export default App;
