import React from 'react';

export default function CreateRoomPopup() {
  const createRoom = () => {};

  return (
    <div>
      <form>
        <input type='text' placeholder='Room name' />
        <button onClick={createRoom}>Submit</button>
      </form>
    </div>
  );
}
