const socket = io();

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

// Game Phases
const waitingPhase = document.getElementById("waiting-phase");
const mainContent = document.getElementById("main-content");
const questionPhase = document.getElementById("question-phase");
const revealPhase = document.getElementById("reveal-phase");

// Waiting Phase Elements
const waitingUserList = document.getElementById("waiting-user-list");
const startGameBtn = document.getElementById("start-game-btn");

// Question Phase Elements
const questionImage = document.getElementById("question-image");
const questionText = document.getElementById("question-text");
const answerInput = document.getElementById("answer-input");
const submitAnswerBtn = document.getElementById("submit-answer-btn");

// Reveal Phase Elements
const answersContainer = document.getElementById("answers-container");
const nextRoundBtn = document.getElementById("next-round-btn");

// Chat Elements
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");

// App State
let state = {
  nickname: "",
  roomId: "",
  currentRound: -1,
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
      const response = await fetch(`/rooms`, { method: "POST" });
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

// 게임 시작
startGameBtn.addEventListener("click", () => {
  socket.emit("start_game", { roomId: state.roomId });
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

  // --- 상단 헤더 정보 업데이트 ---
  roomCodeSpan.textContent = roomState.roomId;
  roundDiv.textContent = roomState.roundIndex + 1;
  timerDiv.textContent = roomState.timer;
  userListDiv.textContent = `참여중: ${roomState.users
    .map((u) => u.nickname)
    .join(", ")}`;

  // --- 새로운 라운드 시작 시 처리 ---
  // 라운드가 바뀌었다면, 현재 라운드를 업데이트하고 답변 입력창을 비운다.
  if (roomState.roundIndex !== state.currentRound) {
    state.currentRound = roomState.roundIndex;
    answerInput.value = "";
  }

  // --- 게임 단계별 UI 처리 ---
  if (roomState.phase === "waiting") {
    waitingPhase.style.display = "block";
    mainContent.style.display = "none";

    // 대기자 목록 업데이트
    waitingUserList.innerHTML = roomState.users
      .map(
        (user) =>
          `<p class="p-2 bg-gray-700 rounded">${user.nickname} ${
            user.socketId === roomState.host ? "(방장)" : ""
          }</p>`
      )
      .join("");

    // 방장에게만 시작 버튼 표시
    if (socket.id === roomState.host) {
      startGameBtn.style.display = "block";
    }
  } else {
    // "answer" 또는 "reveal" 단계
    waitingPhase.style.display = "none";
    mainContent.style.display = "grid";

    if (roomState.question) {
      questionImage.src = roomState.question.imageUrl;
      questionText.textContent = roomState.question.text;
    }

    if (roomState.phase === "answer") {
      questionPhase.style.display = "block";
      revealPhase.style.display = "none";
      submitAnswerBtn.disabled = false;
      submitAnswerBtn.textContent = "답변 제출";

      // 내가 현재 라운드에 제출한 답변이 있는지 확인
      const myAnswer = roomState.answers[roomState.roundIndex]?.find(
        (a) => a.nickname === state.nickname
      );
      if (myAnswer) {
        // 제출한 답변이 있다면, 입력창에 표시하고 버튼을 비활성화
        answerInput.value = myAnswer.text;
        submitAnswerBtn.disabled = true;
        submitAnswerBtn.textContent = "답변 제출 완료";
      }
      // (중요) 제출한 답변이 없을 경우, 입력창을 건드리지 않아 사용자의 입력을 보존
    } else {
      // "reveal" 단계
      questionPhase.style.display = "none";
      revealPhase.style.display = "block";
      renderAnswers(roomState.answers[roomState.roundIndex] || []);
    }
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

  document.querySelectorAll(".reaction-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const answerId = btn.dataset.answerId;
      const reaction = btn.dataset.reaction;
      socket.emit("react_answer", { roomId: state.roomId, answerId, reaction });
    });
  });
}

function addChatMessage({ nickname, text }) {
  const msgEl = document.createElement("div");
  const isMyMessage = nickname === state.nickname;

  msgEl.innerHTML = `
    <p class="${isMyMessage ? "text-right" : "text-left"}">
      <span class="font-bold text-sm ${
        isMyMessage ? "text-green-400" : "text-yellow-400"
      }">${nickname}</span>:
      <span class="text-base">${text}</span>
    </p>
  `;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}