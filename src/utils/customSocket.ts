import { Socket } from 'socket.io';

class mySocket extends Socket {
  roomID: string;
}

export default mySocket;
