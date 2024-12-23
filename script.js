document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registration-form');
    const startGameButton = document.getElementById('start-game');
    const sendChatButton = document.getElementById('send-chat');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const playersContainer = document.getElementById('players');
    const gameStatus = document.getElementById('game-status');
    const languageSelect = document.getElementById('language-select');
    const rulesTitle = document.getElementById('rules-title');
    const rulesContent = document.getElementById('rules-content');
    const recordsList = document.getElementById('records-list');
    let players = [];
    let currentPlayerIndex = 0;
    let managerId = null;
    let transferRequests = [];
    let sessionRecords = [];
    const signalingServerUrl = 'wss://your-signaling-server-url'; // Replace with your actual signaling server URL
    let chatSocket = null;
    let currentLanguage = 'en';

    const translations = {
        en: {
            title: 'Bingo Game',
            registrationTitle: 'Player Registration',
            addPlayerButton: 'Add Player',
            startGameButton: 'Start Game',
            chatPlaceholder: 'Type a message...',
            sendChatButton: 'Send',
            currentTurn: 'Current turn: ',
            gameOver: 'Game Over! ',
            wins: ' wins!',
            requestTransfer: 'Request Manager Transfer',
            manager: 'Current Manager: ',
            rulesTitle: 'Bingo Rules',
            rulesContent: 'Bingo is a game of chance where each player has a card with a 5x5 grid of numbers. The objective is to mark off numbers on your card as they are called out. The first player to mark off a complete row, column, or diagonal shouts "Bingo!" and wins the game.',
        },
        ja: {
            title: 'ビンゴゲーム',
            registrationTitle: 'プレイヤー登録',
            addPlayerButton: 'プレイヤーを追加',
            startGameButton: 'ゲームを開始',
            chatPlaceholder: 'メッセージを入力...',
            sendChatButton: '送信',
            currentTurn: '現在のターン: ',
            gameOver: 'ゲームオーバー! ',
            wins: ' 勝ちました!',
            requestTransfer: 'マネージャーの転送をリクエストする',
            manager: '現在のマネージャー: ',
            rulesTitle: 'ビンゴのルール',
            rulesContent: 'ビンゴは、各プレイヤーが5x5の数字のグリッドを持つカードを持っているチャンスのゲームです。目標は、番号が呼び出されたときにカード上の番号をマークすることです。最初に完全な行、列、または対角線をマークしたプレイヤーが「ビンゴ！」と叫び、ゲームに勝ちます。',
        }
    };

    function updateLanguage() {
        const t = translations[currentLanguage];
        document.getElementById('title').textContent = t.title;
        document.getElementById('registration-title').textContent = t.registrationTitle;
        document.getElementById('add-player-button').textContent = t.addPlayerButton;
        startGameButton.textContent = t.startGameButton;
        chatInput.placeholder = t.chatPlaceholder;
        sendChatButton.textContent = t.sendChatButton;
        gameStatus.textContent = '';
        rulesTitle.textContent = t.rulesTitle;
        rulesContent.textContent = t.rulesContent;
        document.querySelectorAll('.request-transfer').forEach(button => {
            button.textContent = t.requestTransfer;
        });
    }

    languageSelect.addEventListener('change', (event) => {
        currentLanguage = event.target.value;
        updateLanguage();
    });

    registrationForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const playerNameInput = document.getElementById('player-name');
        const playerName = playerNameInput.value.trim();
        if (playerName) {
            const playerId = players.length + 1;
            players.push({ id: playerId, name: playerName, score: 0 });
            createPlayer(playerId, playerName);
            playerNameInput.value = '';
            if (players.length === 1) {
                setManager(playerId);
            }
        }
    });

    startGameButton.addEventListener('click', () => {
        if (players.length > 0) {
            startGame();
            initializeChat();
        } else {
            alert('Please add at least one player.');
        }
    });

    sendChatButton.addEventListener('click', sendMessage);

    function createBingoBoard(playerId) {
        const board = document.createElement('div');
        board.classList.add('bingo-board');
        board.id = `board-${playerId}`;
        const numbers = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);

        numbers.forEach(number => {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.textContent = number;
            cell.addEventListener('click', () => {
                if (players[currentPlayerIndex].id === playerId) {
                    cell.classList.toggle('marked');
                    checkBingo(playerId);
                }
            });
            board.appendChild(cell);
        });

        return board;
    }

    function createPlayer(playerId, playerName) {
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player');
        playerDiv.id = `player-${playerId}`;

        const playerTitle = document.createElement('h2');
        playerTitle.textContent = playerName;
        playerDiv.appendChild(playerTitle);

        playerDiv.appendChild(createBingoBoard(playerId));

        const transferButton = document.createElement('button');
        transferButton.classList.add('request-transfer');
        transferButton.textContent = translations[currentLanguage].requestTransfer;
        transferButton.addEventListener('click', () => {
            requestManagerTransfer(playerId);
        });
        playerDiv.appendChild(transferButton);

        playersContainer.appendChild(playerDiv);
    }

    function checkBingo(playerId) {
        const cells = Array.from(document.querySelectorAll(`#board-${playerId} .cell`));
        const rows = [0, 1, 2, 3, 4].map(i => cells.slice(i * 5, i * 5 + 5));
        const columns = [0, 1, 2, 3, 4].map(i => cells.filter((_, index) => index % 5 === i));
        const diagonals = [
            [0, 6, 12, 18, 24],
            [4, 8, 12, 16, 20]
        ].map(indices => indices.map(index => cells[index]));

        const allLines = [...rows, ...columns, ...diagonals];

        allLines.forEach(line => {
            if (line.every(cell => cell.classList.contains('marked'))) {
                const playerName = players.find(player => player.id === playerId).name;
                alert(`${translations[currentLanguage].gameOver} ${playerName}${translations[currentLanguage].wins}`);
                gameStatus.textContent = `${translations[currentLanguage].gameOver} ${playerName}${translations[currentLanguage].wins}`;
                recordWin(playerId);
                resetGame();
            }
        });

        switchTurn();
    }

    function switchTurn() {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        updateTurnDisplay();
    }

    function updateTurnDisplay() {
        document.querySelectorAll('.player').forEach(playerDiv => {
            playerDiv.classList.remove('turn');
        });
        const currentPlayerDiv = document.getElementById(`player-${players[currentPlayerIndex].id}`);
        currentPlayerDiv.classList.add('turn');
        gameStatus.textContent = `${translations[currentLanguage].currentTurn} ${players[currentPlayerIndex].name}`;
    }

    function startGame() {
        playersContainer.innerHTML = '';
        players.forEach(player => {
            createPlayer(player.id, player.name);
        });
        currentPlayerIndex = 0;
        updateTurnDisplay();
    }

    function resetGame() {
        players.forEach(player => player.score = 0);
        playersContainer.innerHTML = '';
        gameStatus.textContent = '';
        transferRequests = [];
        sessionRecords = [];
        updateSessionRecords();
    }

    function setManager(playerId) {
        managerId = playerId;
        document.querySelectorAll('.manager').forEach(el => el.classList.remove('manager'));
        const managerDiv = document.getElementById(`player-${playerId}`);
        managerDiv.classList.add('manager');
        updateTransferButtons();
        gameStatus.textContent = `${translations[currentLanguage].manager} ${players.find(player => player.id === playerId).name}`;
    }

    function updateTransferButtons() {
        document.querySelectorAll('.request-transfer').forEach(button => {
            button.style.display = managerId !== parseInt(button.parentElement.id.replace('player-', '')) ? 'block' : 'none';
        });
    }

    function requestManagerTransfer(requesterId) {
        if (!transferRequests.includes(requesterId)) {
            transferRequests.push(requesterId);
            if (managerId === players[currentPlayerIndex].id) {
                approveManagerTransfer(requesterId);
            } else {
                alert(`Transfer request sent to the manager.`);
            }
        }
    }

    function approveManagerTransfer(requesterId) {
        const requesterName = players.find(player => player.id === requesterId).name;
        const confirmation = confirm(`Approve transfer request from ${requesterName}?`);
        if (confirmation) {
            setManager(requesterId);
            alert(`Manager role transferred to ${requesterName}`);
            transferRequests = [];
        }
    }

    function recordWin(playerId) {
        const player = players.find(player => player.id === playerId);
        player.score += 1;
        sessionRecords.push({ name: player.name, score: player.score });
        updateSessionRecords();
    }

    function updateSessionRecords() {
        recordsList.innerHTML = '';
        sessionRecords.forEach(record => {
            const recordItem = document.createElement('li');
            recordItem.textContent = `${record.name}: ${record.score}`;
            recordsList.appendChild(recordItem);
        });
    }

    function initializeChat() {
        chatSocket = new WebSocket(signalingServerUrl); // Reuse signaling server for chat
        chatSocket.onmessage = handleChatMessage;
        chatSocket.onopen = () => {
            chatSocket.send(JSON.stringify({ type: 'join', playerId: players[currentPlayerIndex].id }));
        };
    }

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            chatSocket.send(JSON.stringify({ type: 'chat', message, playerId: players[currentPlayerIndex].id }));
            appendMessage(players[currentPlayerIndex].name, message);
            chatInput.value = '';
        }
    }

    function handleChatMessage(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') {
            const playerName = players.find(player => player.id === data.playerId).name;
            appendMessage(playerName, data.message);
        }
    }

    function appendMessage(playerName, message) {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `${playerName}: ${message}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});