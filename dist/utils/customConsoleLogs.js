"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const customLogs = (message, roomList, socket) => {
    if (roomList && socket) {
        console.log(`--------${message}-------- NAME: ${roomList[socket.roomID] && roomList[socket.roomID].getPeers()[socket.id].name}`);
    }
    else {
        console.log(`--------${message}--------`);
    }
};
exports.default = customLogs;
//# sourceMappingURL=customConsoleLogs.js.map