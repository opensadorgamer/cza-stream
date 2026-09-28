let currentRoom = null;

export function getCurrentRoom() {
    return currentRoom;
}

export function setCurrentRoom(room) {
    currentRoom = room;
}

export function generateRandomRoomCode() {
    return 'sala-' + Math.floor(1000 + Math.random() * 9000);
}
