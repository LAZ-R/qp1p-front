
import { io } from 'https://cdn.socket.io/4.8.1/socket.io.esm.min.js';
import { requestWakeLock } from './wakelock.js';
import { APP_VERSION } from '../properties.js';
import { BACKEND_URL } from '../config.js';

console.log(`Questions pour un poisson | v ${APP_VERSION}`);
requestWakeLock();

// Back-end
const socket = io(BACKEND_URL);

// MJ
let isMJ = window.location.hash == '#mj';
console.log('is mj', isMJ);
let currentMJId = localStorage.getItem('mjId');

// Player
let currentPlayerId = localStorage.getItem('playerId');

if (isMJ) {
  document.getElementById('title').innerHTML = 'QP1P MJ Dashboard';
  document.getElementById('main').classList.add('mj-main');
} else {
  document.getElementById('title').innerHTML = 'Questions pour un poisson';
}
document.getElementById('main').innerHTML = ``;


function onCreateRoomClick() {
  socket.emit('create_room');
}
window.onCreateRoomClick = onCreateRoomClick;

function onJoinRoomClick() {
  console.log('joinRoomClick');
  const playerNameInput = document.getElementById('playerNameInput');
  localStorage.setItem(
    'playerName',
    playerNameInput.value
  );
  socket.emit(
    'join_room',
    playerNameInput.value
  );
}
window.onJoinRoomClick = onJoinRoomClick;

function onNextPhaseClick() {
  socket.emit('next_phase');
}
window.onNextPhaseClick = onNextPhaseClick;

function onEndGameClick() {
  socket.emit('end_game');
}
window.onEndGameClick = onEndGameClick;

socket.on('connect', () => {
  if (!isMJ && currentPlayerId !== null) {
    socket.emit('reconnect_player', currentPlayerId);
  }
  if (isMJ && currentMJId !== null) {
    socket.emit('reconnect_mj', currentMJId);
  }
  console.log('Connecté');
});

socket.on('state_updated', (game) => {
  //console.log(game);
  if (isMJ) {
    renderMJ(game);
  } else {
    renderPlayer(game);
  }
});

socket.on('joined_room', (playerId) => {
  currentPlayerId = playerId;
  localStorage.setItem(
    'playerId',
    playerId
  );
  console.log('MON PLAYER ID :', currentPlayerId);
});

socket.on('error_message', (message) => {
  alert(message);
});

socket.on('joined_as_mj', (mjId) => {
  currentMJId = mjId;
  localStorage.setItem(
    'mjId',
    mjId
  );
});

function getCurrentPlayer(game) {
  const player = game.players.find((player) => player.playerId === currentPlayerId);
  return player ?? null;
}

function getAnswersDom(game) {
  let str = ``;
  const currentQuestion = game.questions[game.currentQuestionIndex];
  const currentPlayer = getCurrentPlayer(game);
  if (currentPlayer == null) return '';
  
  currentQuestion.answers.forEach((answer) => {
    let classStr = '';
    const isSelected = currentPlayer.selectedAnswerId == answer.id;
    if (game.gameState.phase !== 'REVEAL' && game.gameState.phase !== 'QUESTION_OUTRO') {
      classStr = isSelected ? 'selected' : '';
    } else {
      const isCorrectAnswer = answer.id == game.questions[game.currentQuestionIndex].correctAnswerId;
      const hadCorrectAnswer = currentPlayer.selectedAnswerId === game.questions[game.currentQuestionIndex].correctAnswerId;
      if (isCorrectAnswer) {
        classStr = 'correct';
      }
      if (!hadCorrectAnswer && isSelected) {
        classStr = 'incorrect';
      }
    }

    str += `
      <button 
        id="answer${answer.id}"
        onclick="onAnswerClick('${answer.id}')"
        class="player-answer ${classStr}"
        ${game.gameState.phase !== 'QUESTION_ACTIVE' ? 'disabled' : ''}
      >
      ${answer.text}
      </button>
    `;
  });
  return str;
}

function onAnswerClick(answerId) {
  socket.emit('submit_answer', Number(answerId));
}
window.onAnswerClick = onAnswerClick;

function escapeHTML(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getPlayersListDomString(game, showScore = false, isScoreBoard = false) {
  let playersDOMString = '';
  const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
  for (const player of sortedPlayers) {
    let index = sortedPlayers.indexOf(player);
    let isGold = index == 0 && player.score != 0;
    let isSilver = index == 1 && player.score != 0;
    let isBronze = index == 2 && player.score != 0;
    playersDOMString += `
      <div class="player-card ${isScoreBoard ? `${isGold ? 'gold ' : isSilver ? 'silver ' : isBronze ? 'bronze ' : ''}` : ''} ">
        <span class="player-name">${isScoreBoard ? `${isGold ? '🥇 ' : isSilver ? '🥈 ' : isBronze ? '🥉 ' : ''}` : ''}${escapeHTML(player.name)}</span>
        ${showScore ? `<span class="mj-player-score">${player.score} pts</span>` : ''}
      </div>
    `;
  };
  return playersDOMString;
}

function renderPlayer(game) {
  const MAIN = document.getElementById('main');
  const PHASE = game.gameState.phase;

  // LOBBY ====================================================================

  if (PHASE == 'LOBBY') {
    const hasNoRoom = game.code == 'No room';
    if (hasNoRoom) {
      localStorage.removeItem('playerId');
      MAIN.classList.add('centered');
      MAIN.innerHTML = `<span class="main-title">Aucun salon disponible<br>Veuillez patienter</span>`;
    } else {
      const hasAlreadyJoined = getCurrentPlayer(game) != null;
      if (hasAlreadyJoined) {
        MAIN.classList.remove('centered');
        MAIN.innerHTML = `
          <span class="main-title">Salon ${game.code}</span>
          <div class="purple-container">Veuillez patienter</div>
          <hr style="width: 100%;">
          <div id="playersList" class="players-list"></div>
        `;
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = getPlayersListDomString(game);
      } else {
        MAIN.classList.add('centered');
        MAIN.innerHTML = `
          <div id="joinRoomBlock" class="player-join-room-block">
            <input id="playerNameInput" placeholder="Pseudo">
            <button id="joinRoomBtn" onclick="onJoinRoomClick()">Rejoindre salon</button>
          </div>
        `;
      }
    }
    return;
  }

  // QUESTION_INTRO ===========================================================

  if (PHASE == 'QUESTION_INTRO') {
    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">Préparez-vous !</div>
    `;
    return;
  }

  // QUESTION_ACTIVE ===========================================================

  if (PHASE == 'QUESTION_ACTIVE') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      <hr style="width: 100%;">
      <div id="answersList" class="player-answers-list">${getAnswersDom(game)}</div>
    `;
    return;
  }

  // LOCK_ANSWERS ===========================================================

  if (PHASE == 'LOCK_ANSWERS') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      <hr style="width: 100%;">
      <div id="answersList" class="player-answers-list">${getAnswersDom(game)}</div>
    `;
    return;
  }

  // REVEAL ===========================================================

  if (PHASE == 'REVEAL') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      <hr style="width: 100%;">
      <div id="answersList" class="player-answers-list">${getAnswersDom(game)}</div>
    `;
    return;
  }

  // QUESTION_OUTRO ===========================================================

  if (PHASE == 'QUESTION_OUTRO') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      <hr style="width: 100%;">
      <div id="answersList" class="player-answers-list">${getAnswersDom(game)}</div>
    `;
    return;
  }

  // SCORE_BOARD ===========================================================

  if (PHASE == 'SCORE_BOARD') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">Scores</div>
      <hr style="width: 100%;">
      <div id="playersList" class="players-list">${getPlayersListDomString(game, true, true)}</div>
    `;
    return;
  }

  // END ===========================================================

  if (PHASE == 'END') {
    MAIN.innerHTML = `
      <span class="main-title">Fin de la partie</span>
      <div class="purple-container">Classement final</div>
      <hr style="width: 100%;">
      <div id="playersList" class="players-list">${getPlayersListDomString(game, true, true)}</div>
    `;
    return;
  }
}

function getMjPhaseDomString(phase) {
  return `
    <button id="endGameBtn" onclick="onEndGameClick()">Tuer salon</button>
    <span id="phaseText" ${phase == 'QUESTION_ACTIVE' ? ' class="active"' : ''}>${phase}</span>
    <button id="nextPhaseBtn" onclick="onNextPhaseClick()">Phase suivante</button>
  `;
}

function renderMJ(game) {
  const MAIN = document.getElementById('main');
  const PHASE = game.gameState.phase;

  // LOBBY ====================================================================

  if (PHASE == 'LOBBY') {
    const hasNoRoom = game.code == 'No room';
    if (hasNoRoom) {
      MAIN.classList.add('centered');
      MAIN.innerHTML = `
        <span class="main-title">Aucun salon</span>
        <button id="createRoomBtn" onclick="onCreateRoomClick()">Créer un salon</button>
      `;
    } else {
      MAIN.classList.remove('centered');
      MAIN.innerHTML = `
        <span class="main-title">Salon ${game.code}</span>
        
        <hr style="width: 100%;">

        <div class="mj-players-top-area">
          <span>Joueurs</span>
          <span id="playersCountDisplay">${game.players.length}</span>
        </div>
        <div id="playersList" class="mj-players-list">${getPlayersListDomString(game)}</div>

        <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
      `;
    }
    return;
  }

  // QUESTION_INTRO ===========================================================

  if (PHASE == 'QUESTION_INTRO') {
    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">Préparez-vous !</div>
      
      <div class="mj-players-top-area">
        <span>Players</span>
        <span id="playersCountDisplay">${game.players.length}</span>
      </div>
      <div id="playersList" class="mj-players-list">${getPlayersListDomString(game, true)}</div>

      <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
    `;
    return;
  }

  // QUESTION_ACTIVE ===========================================================

  if (PHASE == 'QUESTION_ACTIVE') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    let playersListDomString = '';
    let answered = 0;

    const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
    for (let player of sortedPlayers) {
      const hasAnswered = player.selectedAnswerId != null;
      if (hasAnswered) answered ++;
      playersListDomString += `
        <div class="player-card ${hasAnswered ? 'has-answered' : ''}">
          <span class="player-name">${escapeHTML(player.name)}</span>
          <span class="player-score">${player.score} pts</span>
        </div>
      `;
    }

    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      
      <div class="mj-players-top-area">
        <span>Players</span>
        <span id="playersCountDisplay">${answered}/${game.players.length}</span>
      </div>
      <div id="playersList" class="mj-players-list">${playersListDomString}</div>

      <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
    `;
    return;
  }

  // LOCK_ANSWERS ===========================================================

  if (PHASE == 'LOCK_ANSWERS') {
    const currentQuestion = game.questions[game.currentQuestionIndex];

    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      
      <div class="mj-players-top-area">
        <span>Players</span>
        <span id="playersCountDisplay">${game.players.length}</span>
      </div>
      <div id="playersList" class="mj-players-list">${getPlayersListDomString(game, true)}</div>

      <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
    `;
    return;
  }

  // REVEAL ===========================================================

  if (PHASE == 'REVEAL') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    // Update scores
    let playersListDomString = '';
    let correctAnswers = 0;
    const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
    for (let player of sortedPlayers) {
      const goodAnswer = player.selectedAnswerId == currentQuestion.correctAnswerId;
      if (goodAnswer) correctAnswers ++;
      playersListDomString += `
        <div class="player-card ${goodAnswer ? 'correct' : 'incorrect'}">
          <span class="player-name">${escapeHTML(player.name)}</span>
          <span class="player-score">${player.score} pts</span>
        </div>
      `;
    }

    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      
      <div class="mj-players-top-area">
        <span>Players</span>
        <span id="playersCountDisplay">${correctAnswers}/${game.players.length}</span>
      </div>
      <div id="playersList" class="mj-players-list">${playersListDomString}</div>

      <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
    `;
    return;
  }

  // QUESTION_OUTRO ===========================================================

  if (PHASE == 'QUESTION_OUTRO') {
    const currentQuestion = game.questions[game.currentQuestionIndex];
    // Update scores
    let playersListDomString = '';
    let correctAnswers = 0;
    const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
    for (let player of sortedPlayers) {
      const goodAnswer = player.selectedAnswerId == currentQuestion.correctAnswerId;
      if (goodAnswer) correctAnswers ++;
      playersListDomString += `
        <div class="player-card ${goodAnswer ? 'correct' : 'incorrect'}">
          <span class="player-name">${escapeHTML(player.name)}</span>
          <span class="player-score">${player.score} pts</span>
        </div>
      `;
    }

    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">${currentQuestion.title}</div>
      
      <div class="mj-players-top-area">
        <span>Players</span>
        <span id="playersCountDisplay">${game.players.length}</span>
      </div>
      <div id="playersList" class="mj-players-list">${playersListDomString}</div>

      <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
    `;
    return;
  }

  // SCORE_BOARD ===========================================================

  if (PHASE == 'SCORE_BOARD') {
    const currentQuestion = game.questions[game.currentQuestionIndex];

    MAIN.innerHTML = `
      <span class="main-title">Question ${game.currentQuestionIndex + 1}</span>
      <div class="purple-container">Scores</div>
      
      <div class="mj-players-top-area">
        <span>Players</span>
        <span id="playersCountDisplay">${game.players.length}</span>
      </div>
      <div id="playersList" class="mj-players-list">${getPlayersListDomString(game, true, true)}</div>

      <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
    `;
    return;
  }

  // END ===========================================================

  if (PHASE == 'END') {
    MAIN.innerHTML = `
      <span class="main-title">Fin de la partie</span>
      <div class="purple-container">Classement final</div>
      
      <div class="mj-players-top-area">
        <span>Players</span>
        <span id="playersCountDisplay">${game.players.length}</span>
      </div>
      <div id="playersList" class="mj-players-list">${getPlayersListDomString(game, true, true)}</div>

      <div id="mjPhaseArea" class="mj-phase-area">${getMjPhaseDomString(PHASE)}</div>
    `;
    return;
  }
}