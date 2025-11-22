const SERVER_URL = "http://localhost:4000";
const socket = io(SERVER_URL);

// DOM Elements
const lobby = document.getElementById("lobby");
const room = document.getElementById("room");
const joinBtn = document.getElementById("join-btn");
const nicknameInput = document.getElementById("nickname");
const roomIdInput = document.getElementById("room-id");
const roomCodeSpan = document.getElementById("room-code");
const userListDiv = document.getElementById("user-list");
const timerDiv = document.getElementById("timer");
const roundDiv = document.getElementById("round");
const questionImage = document.getElementById("question-image");
const questionText = document.getElementById("question-text");
const answerInput = document.getElementById("answer-input");
const submitAnswerBtn = document.getElementById("submit-answer-btn");
const questionPhase = document.getElementById("question-phase");
const revealPhase = document.getElementById("reveal-phase");
const answersContainer = document.getElementById("answers-container");
const nextRoundBtn = document.getElementById("next-round-btn");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");

// App State
let state = {
  nickname: "",
  roomId: "",
};

// --- Event Listeners ---

// 방 입장/생성
joinBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  let roomId = roomIdInput.value.trim();

  if (!nickname) {
    alert("닉네임을 입력해주세요.");
    return;
  }

  state.nickname = nickname;

  if (!roomId) {
    // 방 생성
    try {
      const response = await fetch(`${SERVER_URL}/rooms`, {
        method: "POST",
      });
      const data = await response.json();
      roomId = data.roomId;
    } catch (error) {
      console.error("Error creating room:", error);
      alert("방을 생성하는 데 실패했습니다.");
      return;
    }
  }

  state.roomId = roomId;
  socket.emit("join_room", { roomId, nickname });
});

// 답변 제출
submitAnswerBtn.addEventListener("click", () => {
  const text = answerInput.value;
  if (!text.trim()) return alert("답변을 입력해주세요.");

  socket.emit("submit_answer", {
    roomId: state.roomId,
    nickname: state.nickname,
    text,
  });
  submitAnswerBtn.disabled = true;
  submitAnswerBtn.textContent = "답변 제출 완료";
});

// 다음 라운드
nextRoundBtn.addEventListener("click", () => {
  socket.emit("next_round", { roomId: state.roomId });
});

// 채팅
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const text = chatInput.value;
    if (!text.trim()) return;

    socket.emit("send_chat", {
      roomId: state.roomId,
      nickname: state.nickname,
      text,
    });
    chatInput.value = "";
  }
});

// --- Socket Event Handlers ---

socket.on("connect", () => {
  console.log("Connected to server, socket ID:", socket.id);
});

socket.on("error_msg", (message) => {
  alert(message);
});

socket.on("room_state", (roomState) => {
  console.log("Received room state:", roomState);
  updateUI(roomState);
});

socket.on("chat_message", (msg) => {
  addChatMessage(msg);
});

// --- UI Update Functions ---

function updateUI(roomState) {
  // 로비 숨기고 방 표시
  if (lobby.style.display !== "none") {
    lobby.style.display = "none";
    room.style.display = "block";
  }

  roomCodeSpan.textContent = roomState.roomId;
  roundDiv.textContent = roomState.roundIndex + 1;
  timerDiv.textContent = roomState.timer;

  // 유저 목록
  userListDiv.textContent = `참여중: ${roomState.users
    .map((u) => u.nickname)
    .join(", ")}`;

  // 질문
  if (roomState.question) {
    questionImage.src = roomState.question.imageUrl;
    questionText.textContent = roomState.question.text;
  }

  // 단계별 UI (답변 vs 공개)
  if (roomState.phase === "answer") {
    questionPhase.style.display = "block";
    revealPhase.style.display = "none";
    submitAnswerBtn.disabled = false;
    submitAnswerBtn.textContent = "답변 제출";

    // 내가 이미 답변했는지 확인
    const myAnswer = roomState.answers[roomState.roundIndex]?.find(
      (a) => a.nickname === state.nickname
    );
    if (myAnswer) {
      answerInput.value = myAnswer.text;
      submitAnswerBtn.disabled = true;
      submitAnswerBtn.textContent = "답변 제출 완료";
    } else {
      answerInput.value = "";
    }
  } else {
    // reveal phase
    questionPhase.style.display = "none";
    revealPhase.style.display = "block";
    renderAnswers(roomState.answers[roomState.roundIndex] || []);
  }
}

function renderAnswers(answers) {
  answersContainer.innerHTML = "";
  if (answers.length === 0) {
    answersContainer.innerHTML = `<p class="text-gray-400 text-center">아직 제출된 답변이 없습니다.</p>`;
    return;
  }

  answers.forEach((answer) => {
    const answerEl = document.createElement("div");
    answerEl.className = "bg-gray-700 p-4 rounded-lg";
    answerEl.innerHTML = `
      <p class="text-lg">"${answer.text}"</p>
      <div class="flex justify-between items-center mt-2">
        <span class="text-sm font-bold text-cyan-400">${answer.nickname}</span>
        <div class="flex gap-2">
          <button class="reaction-btn" data-answer-id="${answer.id}" data-reaction="like">👍 ${answer.reactions.like}</button>
          <button class="reaction-btn" data-answer-id="${answer.id}" data-reaction="wow">😮 ${answer.reactions.wow}</button>
          <button class="reaction-btn" data-answer-id="${answer.id}" data-reaction="funny">😂 ${answer.reactions.funny}</button>
        </div>
      </div>
    `;
    answersContainer.appendChild(answerEl);
  });

  // 리액션 버튼에 이벤트 리스너 추가
  document.querySelectorAll(".reaction-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const answerId = btn.dataset.answerId;
      const reaction = btn.dataset.reaction;
      socket.emit("react_answer", { roomId: state.roomId, answerId, reaction });
    });
  });
}

function addChatMessage({ nickname, text, createdAt }) {
  const msgEl = document.createElement("div");
  const isMyMessage = nickname === state.nickname;
  
  msgEl.innerHTML = `
    <p class="${isMyMessage ? 'text-right' : 'text-left'}">
      <span class="font-bold text-sm ${isMyMessage ? 'text-green-400' : 'text-yellow-400'}">${nickname}</span>:
      <span class="text-base">${text}</span>
    </p>
  `;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
