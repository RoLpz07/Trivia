// --- VARIABLES GLOBALES ---
let config = {};
let questions = [];
let current = 0;
let score = 0;
let correct = 0;
let incorrect = 0;
let timer = null;
let timeLeft = 20;
let timesPerQuestion = [];
let categories = [];
let lastConfig = null;

// --- UTILIDADES ---
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
function decodeHTMLEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
}

// --- RENDERIZADO DE PANTALLAS ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// --- CARGAR CATEGORÍAS DE LA API ---
async function loadCategories() {
    const res = await fetch('https://opentdb.com/api_category.php');
    const data = await res.json();
    categories = data.trivia_categories;
    const select = document.getElementById('category');
    select.innerHTML = `
        <option value="mixed">Mixtas (todas las categorías)</option>
        ${categories.slice(0, 8).map(cat =>
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('')}
    `;
}

// --- VALIDAR FORMULARIO INICIAL ---
function validateForm() {
    const name = document.getElementById('player').value.trim();
    const num = parseInt(document.getElementById('numQuestions').value, 10);
    if (name.length < 2 || name.length > 20) return false;
    if (isNaN(num) || num < 5 || num > 20) return false;
    return true;
}

// --- INICIAR JUEGO ---
async function startGame(e) {
    e.preventDefault();
    if (!validateForm()) {
        alert('Por favor, completa correctamente los campos.');
        return;
    }
    config = {
        player: document.getElementById('player').value.trim(),
        numQuestions: parseInt(document.getElementById('numQuestions').value, 10),
        difficulty: document.getElementById('difficulty').value,
        category: document.getElementById('category').value
    };
    lastConfig = { ...config };
    questions = [];
    current = 0;
    score = 0;
    correct = 0;
    incorrect = 0;
    timesPerQuestion = [];
    showScreen('loading');
    document.getElementById('loadError').classList.add('hidden');
    try {
        await fetchQuestions();
        showScreen('game');
        renderQuestion();
    } catch (err) {
        document.getElementById('loadError').classList.remove('hidden');
    }
}

// --- OBTENER PREGUNTAS DE LA API ---
async function fetchQuestions() {
    let url = `https://opentdb.com/api.php?amount=${config.numQuestions}`;
    if (config.difficulty !== 'any') url += `&difficulty=${config.difficulty}`;
    if (config.category !== 'mixed') url += `&category=${config.category}`;
    url += '&type=multiple';
    const res = await fetch(url);
    const data = await res.json();
    if (data.response_code !== 0) throw new Error('No se pudieron obtener preguntas');
    questions = data.results;
}

// --- RENDERIZAR PREGUNTA ACTUAL ---
function renderQuestion() {
    if (current >= questions.length) {
        showResults();
        return;
    }
    const q = questions[current];
    document.getElementById('progress').textContent = `Pregunta ${current + 1} de ${questions.length}`;
    document.getElementById('score').textContent = `Puntos: ${score}`;
    document.getElementById('question').innerHTML = decodeHTMLEntities(q.question);
    const options = shuffle([q.correct_answer, ...q.incorrect_answers]);
    const btns = options.map(opt =>
        `<button class="option-btn">${decodeHTMLEntities(opt)}</button>`
    ).join('');
    document.getElementById('options').innerHTML = btns;
    document.getElementById('feedback').textContent = '';
    startTimer();
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => selectAnswer(btn.textContent, q.correct_answer);
    });
}

// --- TEMPORIZADOR POR PREGUNTA ---
function startTimer() {
    clearInterval(timer);
    timeLeft = 20;
    updateTimer();
    timer = setInterval(() => {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) {
            clearInterval(timer);
            timesPerQuestion.push(20);
            showFeedback(false, true);
        }
    }, 1000);
}
function updateTimer() {
    const t = document.getElementById('timer');
    t.textContent = `${timeLeft}s`;
    t.classList.toggle('warning', timeLeft <= 5);
}

// --- SELECCIÓN DE RESPUESTA ---
function selectAnswer(selected, correctAns) {
    clearInterval(timer);
    const isCorrect = selected === decodeHTMLEntities(correctAns);
    timesPerQuestion.push(20 - timeLeft);
    showFeedback(isCorrect, false, selected);
}

// --- FEEDBACK VISUAL Y AVANCE ---
function showFeedback(isCorrect, timeout, selected = null) {
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(btn => {
        if (btn.textContent === decodeHTMLEntities(questions[current].correct_answer)) {
            btn.classList.add('correct');
        } else if (selected && btn.textContent === selected) {
            btn.classList.add('incorrect');
        }
        btn.disabled = true;
    });
    let msg = '';
    if (timeout) {
        msg = '¡Tiempo agotado! La respuesta correcta era: ' + decodeHTMLEntities(questions[current].correct_answer);
        incorrect++;
    } else if (isCorrect) {
        msg = '¡Correcto!';
        score += 10;
        correct++;
    } else {
        msg = 'Incorrecto. La respuesta era: ' + decodeHTMLEntities(questions[current].correct_answer);
        incorrect++;
    }
    document.getElementById('feedback').textContent = msg;
    document.getElementById('score').textContent = `Puntos: ${score}`;
    setTimeout(() => {
        current++;
        renderQuestion();
    }, 1500);
}

// --- MOSTRAR RESULTADOS FINALES ---
function showResults() {
    showScreen('results');
    const total = questions.length;
    const percent = Math.round((correct / total) * 100);
    const avgTime = (timesPerQuestion.reduce((a, b) => a + b, 0) / total).toFixed(1);
    document.getElementById('resultPlayer').textContent = config.player;
    document.getElementById('resultScore').textContent = score;
    document.getElementById('resultCorrect').textContent = `${correct} / ${total}`;
    document.getElementById('resultPercent').textContent = `${percent}%`;
    document.getElementById('resultAvgTime').textContent = `${avgTime} s`;
}

// --- REINICIAR JUEGO ---
function restartGame(sameConfig = true) {
    if (sameConfig && lastConfig) {
        config = { ...lastConfig };
        questions = [];
        current = 0;
        score = 0;
        correct = 0;
        incorrect = 0;
        timesPerQuestion = [];
        showScreen('loading');
        fetchQuestions().then(() => {
            showScreen('game');
            renderQuestion();
        }).catch(() => {
            document.getElementById('loadError').classList.remove('hidden');
        });
    } else {
        showScreen('setup');
    }
}

// --- DOM READY ---
document.addEventListener('DOMContentLoaded', () => {
    showScreen('setup');
    loadCategories();
    // IDs requeridos en tu HTML:
    // setupForm, player, numQuestions, difficulty, category, loading, loadError, game, progress, score, question, options, timer, feedback, results, resultPlayer, resultScore, resultCorrect, resultPercent, resultAvgTime, btnRestart, btnConfig, btnExit, btnRetry
    document.getElementById('setupForm').onsubmit = startGame;
    document.getElementById('btnRestart').onclick = () => restartGame(true);
    document.getElementById('btnConfig').onclick = () => restartGame(false);
    document.getElementById('btnExit').onclick = () => window.location.reload();
    document.getElementById('btnRetry').onclick = () => restartGame(true);
});

