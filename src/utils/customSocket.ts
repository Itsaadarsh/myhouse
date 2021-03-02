import { Socket } from 'socket.io';

class mySocket extends Socket {
  roomID: string | null;
}

export default mySocket;
