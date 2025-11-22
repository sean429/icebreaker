import { v4 as uuid } from "uuid";

export const rooms = {}; // roomId → roomState

export function createRoom() {
  const roomId = uuid().slice(0, 6);
  rooms[roomId] = {
    roomId,
    roundIndex: 0,
    phase: "answer", // "answer" | "reveal"
    timer: 45,
    users: [], // { socketId, nickname }
    answers: {}, // answers[roundIndex] = [...]
    chat: []
  };
  return roomId;
}

export function joinRoom(roomId, socketId, nickname) {
  if (!rooms[roomId]) return false;

  rooms[roomId].users.push({ socketId, nickname });
  return true;
}

export function getRoom(roomId) {
  return rooms[roomId];
}
