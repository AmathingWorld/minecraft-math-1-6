// --- 遊戲狀態變數 ---
let state = {
    selectedChar: null,
    selectedTopic: null,
    currentQuestionIndex: 0,
    questions: [],
    results: [], // 儲存本次遊戲的詳細作答結果
    totalTimer: null,
    questionTimer: null,
    startTime: 0,
    questionStartTime: 0
};

// 角色經驗和道具的持續儲存狀態
let CHAR_STATS = {
    '史帝夫': { exp: 0, level: 1, diamond: 0, redstone: 0, img: '👤' },
    '艾力克斯': { exp: 0, level: 1, diamond: 0, redstone: 0, img: '👩‍🦰' },
    '苦力怕': { exp: 0, level: 1, diamond: 0, redstone: 0, img: '💣' },
    '骷髏': { exp: 0, level: 1, diamond: 0, redstone: 0, img: '💀' },
    '貓咪': { exp: 0, level: 1, diamond: 0, redstone: 0, img: '🐱' },
};

// 儲存所有角色的歷史紀錄：現在會包含 details 陣列
let GAME_HISTORY = [];

const MAX_QUESTIONS = 10;
const EXP_PER_QUESTION = 10;
const BASE_EXP_TO_LEVEL = 100;

// 道具獎勵設定
const LOOT_TABLE = [
    { type: 'diamond', min: 1, max: 1, exp: 50, message: "恭喜挖到一顆閃亮的鑽石！" },
    { type: 'redstone', min: 2, max: 5, exp: 10, message: "你找到了一些紅石粉！" },
    { type: 'iron', min: 1, max: 3, exp: 15, message: "獲得了鐵錠，可以打造工具了！" },
    { type: 'exp', min: 20, max: 50, exp: 0, message: "這題完成得真快，獲得額外經驗值！" },
];

const TOPICS = {
    'basic': {
        name: '紅石基礎電路 (個位數商)',
        generate: () => {
            const quotient = Math.floor(Math.random() * 9) + 1;
            const divisor = Math.floor(Math.random() * 9) + 1;
            const dividend = quotient * divisor;
            return { dividend, divisor, answer: quotient };
        }
    },
    'advanced': {
        name: '末地傳送門 (兩位數商)',
        generate: () => {
            const quotient = Math.floor(Math.random() * 11) + 10;
            const divisor = Math.floor(Math.random() * 9) + 1;
            const dividend = quotient * divisor;
            return { dividend, divisor, answer: quotient };
        }
    }
};

// --- 輔助函數 (保持不變) ---

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// --- RPG/紀錄系統函數 ---

function loadStats() {
    const savedStats = localStorage.getItem('minecraft_math_stats');
    if (savedStats) {
        const parsedStats = JSON.parse(savedStats);
        for (const char in parsedStats) {
            if (CHAR_STATS[char]) {
                CHAR_STATS[char] = { ...CHAR_STATS[char], ...parsedStats[char] };
            }
        }
    }
    const savedHistory = localStorage.getItem('minecraft_math_history');
    if (savedHistory) {
        GAME_HISTORY = JSON.parse(savedHistory);
    }
}

function saveStats() {
    localStorage.setItem('minecraft_math_stats', JSON.stringify(CHAR_STATS));
}

function saveHistory() {
    localStorage.setItem('minecraft_math_history', JSON.stringify(GAME_HISTORY));
}

function updateStatsDisplay() {
    if (!state.selectedChar) return;
    const stats = CHAR_STATS[state.selectedChar];
    document.getElementById('current-exp').innerText = stats.exp;
    document.getElementById('current-level').innerText = stats.level;
    document.getElementById('diamond-count').innerText = stats.diamond || 0;
    document.getElementById('redstone-count').innerText = stats.redstone || 0;
}

function gainExp(amount) {
    const stats = CHAR_STATS[state.selectedChar];
    stats.exp += amount;
    
    let levelUpMessage = '';
    while (stats.exp >= BASE_EXP_TO_LEVEL * stats.level) {
        stats.exp -= BASE_EXP_TO_LEVEL * stats.level; 
        stats.level++;
        levelUpMessage += `\n🚀 ${state.selectedChar} 升級到等級 ${stats.level} 了！`;
    }
    updateStatsDisplay();
    saveStats();
    return levelUpMessage;
}

function giveLoot(isCorrect) {
    if (!isCorrect) return;
    let feedbackText = '';

    const baseExpMessage = gainExp(EXP_PER_QUESTION);
    feedbackText += `\n獲得 ${EXP_PER_QUESTION} 點經驗值。${baseExpMessage}`;

    const lootIndex = Math.floor(Math.random() * LOOT_TABLE.length);
    const loot = LOOT_TABLE[lootIndex];
    const amount = Math.floor(Math.random() * (loot.max - loot.min + 1)) + loot.min;

    if (loot.type === 'exp') {
        gainExp(amount);
        feedbackText += `\n✨ ${loot.message} (額外 +${amount} EXP)`;
    } else {
        if (CHAR_STATS[state.selectedChar][loot.type] === undefined) {
            CHAR_STATS[state.selectedChar][loot.type] = 0;
        }
        
        CHAR_STATS[state.selectedChar][loot.type] += amount;
        gainExp(loot.exp);
        feedbackText += `\n🎁 ${loot.message} (獲得 ${amount} 個)`;
    }
    
    document.getElementById('feedback-message').innerText += feedbackText;
    updateStatsDisplay();
    saveStats();
}

/** 顯示選定角色的歷史紀錄 (大幅修改) */
function displayHistory(characterName) {
    const historyBody = document.getElementById('history-table-body');
    const historyArea = document.getElementById('history-area');
    const filteredHistory = GAME_HISTORY.filter(record => record.char === characterName);

    document.getElementById('history-char-name').innerText = characterName;
    historyBody.innerHTML = '';
    
    if (filteredHistory.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="5">尚無紀錄，快去探險吧！</td></tr>';
    } else {
        // 反轉陣列，讓最新紀錄在最上方
        filteredHistory.slice().reverse().forEach((record, index) => {
            const row = historyBody.insertRow();
            // 第一行：主要摘要資訊
            row.innerHTML = `
                <td>${record.date}</td>
                <td>${record.topic}</td>
                <td>${record.correct}/${MAX_QUESTIONS}</td>
                <td>${formatTime(record.time)}</td>
                <td><button class="block-button" style="padding: 5px 10px; font-size: 12px; background-color: #007bff;" onclick="toggleDetails(${GAME_HISTORY.length - 1 - index})">
                    ${record.detailsVisible ? '▲ 隱藏' : '▼ 詳情'}
                </button></td>
            `;

            // 第二行：詳細作答紀錄（預設隱藏）
            const detailRow = historyBody.insertRow();
            detailRow.id = `details-row-${GAME_HISTORY.length - 1 - index}`;
            detailRow.style.display = record.detailsVisible ? 'table-row' : 'none';
            detailRow.innerHTML = `<td colspan="5">
                <div style="max-height: 200px; overflow-y: auto; background: #f0f0f0; padding: 10px; border-radius: 4px;">
                    <table style="width: 100%; font-size: 12px;">
                        <thead>
                            <tr><th>題號</th><th>算式</th><th>正確答案</th><th>耗時</th></tr>
                        </thead>
                        <tbody>
                            ${record.details.map((r, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${r.question}</td>
                                    <td>${r.answer}</td>
                                    <td>${formatTime(r.time)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </td>`;
        });
    }

    historyArea.classList.remove('hidden');
}

/** 切換單次歷史紀錄的詳細內容 */
window.toggleDetails = function(originalIndex) {
    // 找到原始 GAME_HISTORY 中的紀錄
    const record = GAME_HISTORY[originalIndex];
    if (record) {
        // 切換可見狀態
        record.detailsVisible = !record.detailsVisible;
        saveHistory(); // 儲存狀態

        // 重新繪製歷史紀錄 (最簡單穩定的方法)
        displayHistory(state.selectedChar);
    }
}


// --- 遊戲核心函數 ---

function checkReady() {
    const startBtn = document.getElementById('start-game-btn');
    const historyBtn = document.getElementById('view-history-btn');
    
    if (state.selectedChar && state.selectedTopic) {
        startBtn.disabled = false;
        startBtn.innerText = '啟動傳送門！';
    } else {
        startBtn.disabled = true;
        startBtn.innerText = '啟動傳送門 (請先選擇)';
    }

    if (state.selectedChar) {
        historyBtn.disabled = false;
    } else {
        historyBtn.disabled = true;
    }
    
    document.getElementById('history-area').classList.add('hidden');
}
        
function startGame() {
    state.currentQuestionIndex = 0;
    state.results = [];
    
    generateQuestions(); 
    
    document.getElementById('selection-screen').classList.add('hidden');
    document.getElementById('practice-screen').classList.remove('hidden');

    showNextQuestion();
    startTimers();
}

function generateQuestions() {
    state.questions = [];
    for (let i = 0; i < MAX_QUESTIONS; i++) {
        state.questions.push(TOPICS[state.selectedTopic].generate());
    }
}
        
function generateChoices(correctAnswer) { 
    const choices = new Set([correctAnswer]);
    const minAnswer = 1;
    const maxAnswer = 20;
    
    while (choices.size < 4) {
        let fakeAnswer;
        let range = 3; 
        fakeAnswer = Math.floor(Math.random() * (2 * range + 1)) + (correctAnswer - range);
        
        if (fakeAnswer >= minAnswer && fakeAnswer <= maxAnswer && !choices.has(fakeAnswer)) {
            choices.add(fakeAnswer);
        }
    }
    return Array.from(choices).sort(() => Math.random() - 0.5);
}

function showNextQuestion() {
    if (state.currentQuestionIndex >= MAX_QUESTIONS) {
        showResultsScreen();
        return;
    }
    
    const q = state.questions[state.currentQuestionIndex];
    if (!q) {
        console.error("錯誤：無法找到當前題目。");
        document.getElementById('division-question').innerText = "載入題目失敗，請重試。";
        return;
    }

    document.getElementById('division-question').innerText = `${q.dividend} ÷ ${q.divisor} = ?`;
    document.getElementById('current-question').innerText = state.currentQuestionIndex + 1;
    document.getElementById('feedback-message').innerText = '準備好了嗎？';
    document.getElementById('feedback-message').className = 'feedback';
    
    const choices = generateChoices(q.answer);
    const choicesArea = document.getElementById('choices-area');
    choicesArea.innerHTML = '';

    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'choice-btn block-button';
        button.innerText = choice;
        button.addEventListener('click', () => handleChoice(choice));
        choicesArea.appendChild(button);
    });
    
    startQuestionTimer();
}

function handleChoice(chosenAnswer) {
    document.querySelectorAll('.choice-btn').forEach(btn => btn.disabled = true);
    
    const q = state.questions[state.currentQuestionIndex];
    const feedback = document.getElementById('feedback-message');
    const correctAnswer = q.answer;

    if (chosenAnswer === correctAnswer) {
        // 正確
        clearInterval(state.questionTimer);
        const questionTimeElapsed = Date.now() - state.questionStartTime;

        feedback.innerText = "✅ 正確！正在發放獎勵...";
        feedback.className = 'feedback correct';
        
        giveLoot(true); 
        
        // 記錄本次作答詳情
        state.results.push({
            question: `${q.dividend} ÷ ${q.divisor}`,
            answer: correctAnswer,
            chosen: chosenAnswer,
            time: questionTimeElapsed
        });

        state.currentQuestionIndex++;
        
        setTimeout(showNextQuestion, 2000); 
    } else {
        // 錯誤：將錯誤紀錄也放入 state.results，但不會增加 currentQuestionIndex
        state.results.push({
            question: `${q.dividend} ÷ ${q.divisor}`,
            answer: correctAnswer,
            chosen: chosenAnswer,
            time: Date.now() - state.questionStartTime, // 記錄從計時開始到答錯的時間
            isCorrect: false
        });

        feedback.innerText = "❌ 錯誤！請重新選擇。";
        feedback.className = 'feedback wrong';
        
        document.querySelectorAll('.choice-btn').forEach(btn => btn.disabled = false);
    }
}

function showResultsScreen() {
    stopTimers();
    const totalTimeElapsed = Date.now() - state.startTime;
    
    // 計算正確的題目數 (只計算 isCorrect 不為 false 的，即答對的)
    const totalCorrect = state.results.filter(r => r.isCorrect !== false).length; 

    // 將本次紀錄儲存到歷史紀錄中 (包含詳細作答紀錄)
    GAME_HISTORY.push({
        char: state.selectedChar,
        date: new Date().toLocaleDateString('zh-TW'),
        topic: TOPICS[state.selectedTopic].name,
        correct: totalCorrect,
        time: totalTimeElapsed,
        details: state.results.filter(r => r.isCorrect !== false), // 只儲存答對的作答記錄作為本次詳細紀錄
        detailsVisible: false // 預設歷史紀錄詳情是隱藏的
    });
    saveHistory();

    document.getElementById('practice-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.remove('hidden');

    document.getElementById('result-char').innerText = state.selectedChar;
    document.getElementById('result-topic').innerText = TOPICS[state.selectedTopic].name;
    document.getElementById('result-total-time').innerText = formatTime(totalTimeElapsed);

    // 顯示結果訊息... (略)
    const avgTime = (totalTimeElapsed / 1000) / (totalCorrect || 1); 
    let message = "";
    if (totalCorrect < MAX_QUESTIONS) {
        message = "☠️ 挑戰失敗！苦力怕爆炸了！下次專心點！";
    } else if (avgTime < 10) {
        message = "🔥 你簡直是**指令方塊**！速度太快了！";
    } else if (avgTime < 20) {
        message = "⛏️ 這次挖掘收穫不錯！繼續努力！";
    } else {
        message = "🐢 像在**下界**移動一樣慢... 專注點，下次一定可以更快！";
    }
    document.getElementById('result-message').innerText = message;

    // 顯示本次成績單的表格 (顯示答對的紀錄)
    const tableBody = document.getElementById('results-table-body');
    tableBody.innerHTML = '';
    state.results.filter(r => r.isCorrect !== false).forEach((r, index) => {
        const row = tableBody.insertRow();
        row.insertCell(0).innerText = index + 1;
        row.insertCell(1).innerText = r.question;
        row.insertCell(2).innerText = r.answer;
        row.insertCell(3).innerText = formatTime(r.time);
    });
}

function startTimers() { /* 保持不變 */
    state.startTime = Date.now();
    state.totalTimer = setInterval(() => {
        document.getElementById('total-time').innerText = formatTime(Date.now() - state.startTime);
    }, 1000);
    startQuestionTimer();
}

function stopTimers() { /* 保持不變 */
    clearInterval(state.totalTimer);
    clearInterval(state.questionTimer);
}

function startQuestionTimer() { /* 保持不變 */
    state.questionStartTime = Date.now();
    clearInterval(state.questionTimer);
    state.questionTimer = setInterval(() => {
        document.getElementById('question-time').innerText = formatTime(Date.now() - state.questionStartTime);
    }, 100);
}


// --- 事件監聽器設定 (保持不變) ---

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    updateStatsDisplay(); 
    checkReady(); 

    document.querySelectorAll('.char-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.char-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            
            state.selectedChar = e.target.dataset.char;
            
            document.getElementById('player-name').innerText = state.selectedChar;
            document.getElementById('player-avatar').innerText = e.target.dataset.img;
            
            updateStatsDisplay(); 
            checkReady(); 
        });
    });

    document.querySelectorAll('.topic-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.topic-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');

            state.selectedTopic = e.target.dataset.topicId;
            checkReady(); 
        });
    });

    document.getElementById('start-game-btn').addEventListener('click', startGame);
    
    document.getElementById('view-history-btn').addEventListener('click', () => {
        const historyArea = document.getElementById('history-area');
        if (historyArea.classList.contains('hidden')) {
            displayHistory(state.selectedChar);
        } else {
            historyArea.classList.add('hidden');
        }
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('results-screen').classList.add('hidden');
        document.getElementById('selection-screen').classList.remove('hidden');
        
        state.selectedChar = null;
        state.selectedTopic = null;
        
        document.getElementById('player-name').innerText = '未選擇';
        document.getElementById('player-avatar').innerText = '?';
        document.querySelectorAll('.block-button').forEach(btn => btn.classList.remove('selected'));
        
        checkReady(); 
    });
});