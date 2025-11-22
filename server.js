import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuid } from "uuid";
import { rooms, createRoom, joinRoom, getRoom } from "./rooms.js";

const questions = [
  {
    imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    text: "이 풍경을 보니 어떤 기분이 드나요?",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1517466787929-bc908524a9b7",
    text: "이 사람은 무엇을 향해 달려가고 있을까요?",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e",
    text: "이 공간의 주인은 어떤 사람일 것 같나요?",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1",
    text: "이 사람들 사이에는 어떤 대화가 오가고 있을까요?",
  },
];

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const httpServer = createServer(app);

// Socket.IO 서버
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// 라운드당 45초 (테스트는 10초로 줄여도 됨)
const ROUND_TIME = 45;

// REST: 방 생성
app.post("/rooms", (req, res) => {
  const roomId = createRoom();
  res.json({ roomId });
});

// REST: 방 상태 확인
app.get("/rooms/:roomId", (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "room not found" });
  res.json(room);
});

// ** 소켓 부분 **
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // 방 입장
  socket.on("join_room", ({ roomId, nickname }) => {
    if (!joinRoom(roomId, socket.id, nickname)) {
      socket.emit("error_msg", "방이 존재하지 않습니다.");
      return;
    }

    socket.join(roomId);
    console.log(`${nickname} joined room ${roomId}`);

    broadcastRoomState(roomId);
  });

  // 답변 제출
  socket.on("submit_answer", ({ roomId, text, nickname }) => {
    const room = getRoom(roomId);
    if (!room) return;

    const roundIndex = room.roundIndex;
    if (!room.answers[roundIndex]) {
      room.answers[roundIndex] = [];
    }

    // 기존 답변 수정 or 신규 추가
    const existing = room.answers[roundIndex].find(
      (a) => a.nickname === nickname
    );
    if (existing) {
      existing.text = text;
    } else {
      room.answers[roundIndex].push({
        id: uuid(),
        nickname,
        text,
        reactions: { like: 0, wow: 0, funny: 0 }
      });
    }

    broadcastRoomState(roomId);
  });

  // 리액션
  socket.on("react_answer", ({ roomId, answerId, reaction }) => {
    const room = getRoom(roomId);
    if (!room) return;

    const answers = room.answers[room.roundIndex];
    if (!answers) return;

    const answer = answers.find((a) => a.id === answerId);
    if (answer) {
      answer.reactions[reaction] += 1;
    }

    broadcastRoomState(roomId);
  });

  // 채팅 메시지
  socket.on("send_chat", ({ roomId, text, nickname }) => {
    const room = getRoom(roomId);
    if (!room) return;

    const msg = {
      id: uuid(),
      nickname,
      text,
      createdAt: new Date().toISOString()
    };

    room.chat.push(msg);

    io.to(roomId).emit("chat_message", msg);
  });

  // 다음 라운드로 이동
  socket.on("next_round", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;

    room.roundIndex += 1;
    room.phase = "answer";
    room.timer = ROUND_TIME;

    broadcastRoomState(roomId);
    startRoundTimer(roomId);
  });

  // 방 나가기
  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
    removeUserFromRooms(socket.id);
  });
});

// 방 전체 전송
function broadcastRoomState(roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  // 라운드 인덱스가 질문 배열 길이를 넘어가면 처음부터 다시 순환하도록
  const questionIndex = room.roundIndex % questions.length;
  const currentQuestion = questions[questionIndex];

  io.to(roomId).emit("room_state", { ...room, question: currentQuestion });
}

// 유저 제거
function removeUserFromRooms(socketId) {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    room.users = room.users.filter((u) => u.socketId !== socketId);
    broadcastRoomState(roomId);
  }
}

// 타이머 시작
function startRoundTimer(roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  const timerId = setInterval(() => {
    if (!rooms[roomId]) return clearInterval(timerId);

    if (room.timer <= 0) {
      room.phase = "reveal";
      broadcastRoomState(roomId);
      return clearInterval(timerId);
    }

    room.timer -= 1;
    broadcastRoomState(roomId);
  }, 1000);
}

httpServer.listen(4000, () => {
  console.log("🚀 Icebreaker server running on port 4000");
});
