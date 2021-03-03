import ALLROOMS from 'src/types/allRooms.types.';
import mySocket from './customSocket';

const customLogs = (message: string, roomList?: ALLROOMS, socket?: mySocket) => {
  if (roomList && socket) {
    console.log(
      `--------${message}-------- NAME: ${
        roomList[socket.roomID!] && roomList[socket.roomID!].getPeers()[socket.id].name
      }`
    );
  } else {
    console.log(`--------${message}--------`);
  }
};

export default customLogs;
