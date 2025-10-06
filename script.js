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
const MAX_CHOICE_VALUE = 20; // 定義最大選項值

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
            const quotient = Math.floor(Math.random() * 9) + 1; // 商數 1-9
            const divisor = Math.floor(Math.random() * 9) + 1;
            const dividend = quotient * divisor;
            return { dividend, divisor, answer: quotient };
        }
    },
    'advanced': {
        name: '末地傳送門 (兩位數商)',
        generate: () => {
            // 確保商數在 10-20 之間
            const quotient = Math.floor(Math.random() * 11) + 10; 
            const divisor = Math.floor(Math.random() * 9) + 1;
            const dividend = quotient * divisor;
            return { dividend, divisor, answer: quotient };
        }
    }
};

// --- 輔助函數 ---

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
    state.results = []; // 清除上一次的結果
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

/**
 * 修正後的 generateChoices 函數：固定選項為 1 到 20，並依序排列。
 */
function generateChoices(correctAnswer) { 
    const choices = [];
    
    // 1. 生成 1 到 20 的所有整數作為選項
    for (let i = 1; i <= MAX_CHOICE_VALUE; i++) {
        choices.push(i);
    }
    
    // 2. 移除隨機排序，確保選項依序排列 (1, 2, 3, ...)
    return choices;
}

function showNextQuestion() {
    if (state.currentQuestionIndex >= MAX_QUESTIONS) {
        showResultsScreen();
        return;
    }

    const q = state.questions[state.currentQuestionIndex];
    if (!q) {
        console.error("錯誤：無法找到當前題目。");
        document.getElementById('division-question').innerText = "載入失敗...";
        return;
    }

    // 更新進度顯示
    document.getElementById('current-question').innerText = state.currentQuestionIndex + 1;
    document.getElementById('division-question').innerText = `${q.dividend} ÷ ${q.divisor} = ?`;

    const choicesArea = document.getElementById('choices-area');
    choicesArea.innerHTML = '';
    
    // 檢查答案是否超出選項範圍 (>20)
    if (q.answer > MAX_CHOICE_VALUE) {
        console.error(`警告：正確答案 ${q.answer} 超出最大選項範圍 (${MAX_CHOICE_VALUE})，此題無解。`);
        // 為了確保遊戲可繼續，這裡可以選擇跳過此題或顯示錯誤訊息
        choicesArea.innerHTML = `<p style="color:red;">錯誤：答案超出範圍 (${q.answer})，請重新開始。</p>`;
        return;
    }


    const choices = generateChoices(q.answer);

    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'block-button choice-btn';
        button.innerText = choice;
        button.dataset.answer = choice; // 儲存選項值
        button.addEventListener('click', () => handleChoice(choice, button));
        choicesArea.appendChild(button);
    });

    // 確保所有按鈕都啟用
    document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('wrong-choice', 'correct-choice');
    });

    // 重設本題計時
    state.questionStartTime = Date.now();
    clearInterval(state.questionTimer);
    state.questionTimer = setInterval(updateQuestionTime, 100);
}

// 修改後的 handleChoice 函數 (核心邏輯調整)
function handleChoice(selectedAnswer, button) {
    
    // 暫時禁用所有選項按鈕，防止快速點擊
    document.querySelectorAll('#choices-area button').forEach(btn => btn.disabled = true);
    
    // 停止本題計時 (無論對錯，都需要停止計算本輪作答時間)
    clearInterval(state.questionTimer);
    
    const currentQuestion = state.questions[state.currentQuestionIndex];
    const isCorrect = (parseInt(selectedAnswer) === currentQuestion.answer);
    const feedbackMsg = document.getElementById('feedback-message');

    // 獲取當前作答耗時 (這是從本題開始到現在的總耗時)
    const questionTimeElapsed = Date.now() - state.questionStartTime;

    if (isCorrect) {
        // ✅ 答對邏輯：記錄、獎勵、進入下一題
        button.classList.add('correct-choice');
        feedbackMsg.classList.remove('wrong');
        feedbackMsg.classList.add('correct');
        // 答對時，只顯示鼓勵，不顯示答案
        feedbackMsg.innerText = `✅ 太棒了！答對了！`; 

        // 記錄最終結果 (只在答對時記錄到 state.results)
        state.results.push({
            index: state.currentQuestionIndex + 1,
            question: `${currentQuestion.dividend} ÷ ${currentQuestion.divisor}`,
            answer: currentQuestion.answer,
            time: questionTimeElapsed,
            isCorrect: true 
        });

        // 獎勵
        giveLoot(true);

        // 自動進入下一題
        setTimeout(() => {
            state.currentQuestionIndex++; // 推進到下一題
            showNextQuestion();
            feedbackMsg.innerText = '準備好了嗎？';
            feedbackMsg.classList.remove('correct', 'wrong');
        }, 1500);

    } else {
        // ❌ 答錯邏輯：顯示錯誤、保持在當前題、重新啟用未選中的按鈕
        button.classList.add('wrong-choice'); // 將選錯的按鈕標記為紅色
        button.disabled = true; // 保持選錯的按鈕禁用

        feedbackMsg.classList.remove('correct');
        feedbackMsg.classList.add('wrong');
        feedbackMsg.innerText = `❌ 錯誤！你選了 ${selectedAnswer}，再試一次！`; 
        
        // ❌ 不顯示正確答案

        // ❌ 不進入下一題：state.currentQuestionIndex 保持不變

        // 重新啟用所有尚未被選錯的按鈕
        document.querySelectorAll('#choices-area button:not(.wrong-choice)').forEach(btn => {
            btn.disabled = false;
        });

        // 重新啟動本題計時器 (延續計時，因為玩家還在這題)
        // questionTimeElapsed 已經是總耗時，所以這裡不需要改變 questionStartTime
        state.questionTimer = setInterval(updateQuestionTime, 100);
    }
}


function updateQuestionTime() {
    const totalTime = Date.now() - state.startTime;
    const questionTime = Date.now() - state.questionStartTime;

    document.getElementById('total-time').innerText = formatTime(totalTime);
    document.getElementById('question-time').innerText = formatTime(questionTime);
}

function startTimers() {
    state.startTime = Date.now();
    state.questionStartTime = Date.now();
    
    // 確保只存在一個總計時器
    if (state.totalTimer) clearInterval(state.totalTimer);
    
    state.totalTimer = setInterval(() => {
        document.getElementById('total-time').innerText = formatTime(Date.now() - state.startTime);
    }, 100);

    // questionTimer 由 showNextQuestion 或 handleChoice 啟動/控制
}

function showResultsScreen() {
    // 停止所有計時
    clearInterval(state.totalTimer);
    clearInterval(state.questionTimer);

    const totalTime = Date.now() - state.startTime;
    const correctCount = state.results.filter(r => r.isCorrect).length;
    
    // 儲存歷史紀錄 (包含本次詳細結果)
    const historyEntry = {
        char: state.selectedChar,
        topic: TOPICS[state.selectedTopic].name,
        date: new Date().toLocaleDateString('zh-TW'),
        time: totalTime,
        correct: correctCount,
        details: state.results,
        detailsVisible: false // 預設隱藏詳細紀錄
    };
    GAME_HISTORY.push(historyEntry);
    saveHistory();

    // 更新結果畫面
    document.getElementById('practice-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.remove('hidden');

    document.getElementById('result-char').innerText = state.selectedChar;
    document.getElementById('result-topic').innerText = TOPICS[state.selectedTopic].name;
    document.getElementById('result-total-time').innerText = formatTime(totalTime);

    let message = '';
    if (correctCount === MAX_QUESTIONS) {
        message = '🎊 完美的勝利！你為村莊帶來了和平！';
        document.getElementById('result-message').classList.add('correct');
        document.getElementById('result-message').classList.remove('wrong');
    } else if (correctCount >= MAX_QUESTIONS * 0.8) {
        message = '👍 表現出色！你像鑽石鎬一樣堅固！';
        document.getElementById('result-message').classList.add('correct');
        document.getElementById('result-message').classList.remove('wrong');
    } else {
        message = '⚔️ 冒險結束了。下次再挑戰更深的礦坑吧！';
        document.getElementById('result-message').classList.remove('correct');
        document.getElementById('result-message').classList.add('wrong');
    }
    document.getElementById('result-message').innerText = message;

    // 顯示結果表格
    const resultsBody = document.getElementById('results-table-body');
    resultsBody.innerHTML = state.results.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${r.question}</td>
            <td style="color:${r.isCorrect ? '#28a745' : '#dc3545'};">${r.answer}</td>
            <td>${formatTime(r.time)}</td>
        </tr>
    `).join('');
}


// --- 事件監聽器設定 ---

function setupEventListeners() {
    // 角色選擇
    document.querySelectorAll('.char-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.char-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');

            state.selectedChar = e.target.dataset.char;
            document.getElementById('player-name').innerText = state.selectedChar;
            
            const stats = CHAR_STATS[state.selectedChar];
            document.getElementById('player-avatar').innerText = stats.img;
            updateStatsDisplay(); // 更新經驗值/道具顯示
            checkReady(); 
        });
    });

    // 主題選擇
    document.querySelectorAll('.topic-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.topic-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');

            state.selectedTopic = e.target.dataset.topicId;
            checkReady(); 
        });
    });

    // 開始遊戲
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    
    // 查看歷史紀錄按鈕
    document.getElementById('view-history-btn').addEventListener('click', () => {
        const historyArea = document.getElementById('history-area');
        if (historyArea.classList.contains('hidden')) {
            displayHistory(state.selectedChar);
        } else {
            historyArea.classList.add('hidden');
        }
    });

    // 返回按鈕
    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('results-screen').classList.add('hidden');
        document.getElementById('selection-screen').classList.remove('hidden');
        
        // 重設選擇狀態
        state.selectedChar = null;
        state.selectedTopic = null;
        
        document.getElementById('player-name').innerText = '未選擇';
        document.getElementById('player-avatar').innerText = '?';
        document.querySelectorAll('.block-button').forEach(btn => btn.classList.remove('selected'));
        
        checkReady(); 
    });
}

// 頁面載入時執行
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    setupEventListeners();
});