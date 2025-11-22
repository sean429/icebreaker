import { v4 as uuid } from "uuid";

export const rooms = {}; // roomId → roomState

export function createRoom() {
  const roomId = uuid().slice(0, 6);
  rooms[roomId] = {
    roomId,
    host: null, // 호스트의 socket.id
    timerId: null, // 현재 라운드의 타이머 ID
    roundIndex: 0,
    phase: "waiting", // "waiting" | "answer" | "reveal"
    timer: 45,
    users: [], // { socketId, nickname }
    answers: {}, // answers[roundIndex] = [...]
    chat: []
  };
  return roomId;
}

export function joinRoom(roomId, socketId, nickname) {
  if (!rooms[roomId]) return false;

  // 첫 유저를 호스트로 지정
  if (rooms[roomId].users.length === 0) {
    rooms[roomId].host = socketId;
  }

  rooms[roomId].users.push({ socketId, nickname });
  return true;
}

export function getRoom(roomId) {
  return rooms[roomId];
}
