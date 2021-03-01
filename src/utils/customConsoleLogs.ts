import ALLROOMS from 'src/types/allRooms.types.';
import mySocket from './customSocket';

const customLogs = (message: string, roomList: ALLROOMS, socket: mySocket) => {
  console.log(`--------${message}-------- NAME: ${roomList[socket.roomID].getPeers()[socket.id].name}`);
};

export default customLogs;
