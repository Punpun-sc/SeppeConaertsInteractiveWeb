console.log('script.js geladen');

const hiraganaSet = [
    { char: 'あ', romaji: 'a' },
    { char: 'い', romaji: 'i' },
    { char: 'う', romaji: 'u' },
    { char: 'え', romaji: 'e' },
    { char: 'お', romaji: 'o' }
];

let shuffledSet = [];
let currentIndex = 0;
let timeLeft = 60;
let timerInterval = null;
let model, webcam, labelContainer, maxPredictions;
let modelURL = 'https://teachablemachine.withgoogle.com/models/2dsWbG2qE/';

let mirrorCanvas, mirrorCtx;

// Scoring system variables
let points = 0;
let confidenceTimer = 0;
let lastConfidence = 0;
let gameActive = true;

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function startCamera() {
    const cameraBox = document.querySelector('.camera-box');
    cameraBox.innerHTML = '';

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.borderRadius = '14px';
    video.style.transform = 'scale(1.5)';
    cameraBox.appendChild(video);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        console.log('camera gestart');
    } catch (err) {
        console.error('camera fout:', err);
        cameraBox.innerHTML = '<p style="color:red;padding:1rem;">Camera geblokkeerd: ' + err.message + '</p>';
    }
}

async function loadModel() {
    console.log('model laden...');
    try {
        model = await tmImage.load(modelURL + 'model.json', modelURL + 'metadata.json');
        maxPredictions = model.getTotalClasses();
        console.log('model geladen');

        webcam = new tmImage.Webcam(260, 260, true);
        await webcam.setup();
        await webcam.play();

        mirrorCanvas = document.createElement('canvas');
        mirrorCanvas.width = 260;
        mirrorCanvas.height = 260;
        mirrorCtx = mirrorCanvas.getContext('2d');

        labelContainer = document.querySelector('.answer-box');
        window.requestAnimationFrame(loop);
    } catch (err) {
        console.error('model fout:', err);
        document.querySelector('.answer-box').innerHTML =
            '<p style="color:red;padding:1rem;">Model fout: ' + err.message + '</p>';
    }
}

async function loop() {
    webcam.update();

    mirrorCtx.save();
    mirrorCtx.scale(-1, 1);
    mirrorCtx.drawImage(webcam.canvas, -260, 0, 260, 260);
    mirrorCtx.restore();

    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    if (!model || !mirrorCanvas || !gameActive) return;

    const prediction = await model.predict(mirrorCanvas);

    // Zoek het karakter met de hoogste zekerheid
    let best = prediction[0];
    for (let i = 1; i < prediction.length; i++) {
        if (prediction[i].probability > best.probability) {
            best = prediction[i];
        }
    }

    const confidence = best.probability * 100;
    console.log(`Herkend: ${best.className} (${confidence.toFixed(1)}%)`);

    // Track confidence >= 50% for 2 seconds
    if (confidence >= 50) {
        if (lastConfidence >= 50) {
            confidenceTimer += 16; // Approximately 1 frame ~16ms
            if (confidenceTimer >= 2000) { // 2 seconds
                points++;
                updateScoreDisplay();
                confidenceTimer = 0; // Reset to prevent multiple points from same pose
            }
        } else {
            confidenceTimer = 0;
        }
    } else {
        confidenceTimer = 0;
    }
    lastConfidence = confidence;

    // Zoek het bijbehorende hiragana karakter
    const match = hiraganaSet.find(h => h.romaji === best.className);
    const hiraganaChar = match ? match.char : '?';

    // Toon in answer-box
    labelContainer.innerHTML = `
        <p style="margin:0 0 8px 0; font-size: 14px; color: #555;">Herkend karakter:</p>
        <div style="font-size: 80px; line-height: 1; text-align: center;">${hiraganaChar}</div>
        <div style="text-align: center; font-size: 18px; margin-top: 8px;">${best.className}</div>
        <div style="text-align: center; font-size: 14px; color: ${confidence >= 50 ? '#2d6a2d' : '#777'}; margin-top: 4px; font-weight: ${confidence >= 50 ? 'bold' : 'normal'}">${confidence.toFixed(1)}% zeker</div>
    `;
}

function initializeCharacter() {
    shuffledSet = shuffleArray(hiraganaSet);
    currentIndex = 0;
    displayCharacter();
    startTimer();
}

function displayCharacter() {
    const character = shuffledSet[currentIndex];
    document.querySelector('.prompt').innerHTML =
        `Welk karakter is dit?<br><strong style="font-size:80px;display:block;margin:20px 0;">${character.romaji}</strong>`;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 60;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.querySelector('.time');
    el.innerHTML = `Tijd: ${timeLeft}s`;
    el.style.background = timeLeft <= 3 ? '#8b3a3a' : '#6a2c2c';
}

function updateScoreDisplay() {
    const el = document.querySelector('.score');
    el.innerHTML = `Punten: ${points}`;
}

function endGame() {
    gameActive = false;
    saveScore();
    
    const finalScore = points;
    const previousScores = JSON.parse(localStorage.getItem('hiraganaScores')) || [];
    const totalAttempts = previousScores.length + 1;
    const averageScore = previousScores.length > 0 
        ? (previousScores.reduce((a, b) => a + b, 0) / previousScores.length).toFixed(1)
        : finalScore;

    document.querySelector('.prompt').innerHTML = `
        <h2 style="font-size: 36px; margin-bottom: 20px;">🎉 Spel Voorbij! 🎉</h2>
        <p style="font-size: 24px; margin: 15px 0;">Jouw Score: <strong>${finalScore}</strong></p>
        <p style="font-size: 16px; margin: 10px 0;">Pogingen: ${totalAttempts}</p>
        <p style="font-size: 16px; margin: 10px 0;">Gemiddelde Score: ${averageScore}</p>
    `;
    
    document.querySelector('.answer-box').innerHTML = '<p style="color: #666;">Ververs de pagina om opnieuw te spelen.</p>';
}

function saveScore() {
    const scores = JSON.parse(localStorage.getItem('hiraganaScores')) || [];
    scores.push(points);
    localStorage.setItem('hiraganaScores', JSON.stringify(scores));
}

function nextCharacter() {
    currentIndex++;
    if (currentIndex >= shuffledSet.length) {
        shuffledSet = shuffleArray(hiraganaSet);
        currentIndex = 0;
    }
    displayCharacter();
    startTimer();
}

document.addEventListener('DOMContentLoaded', async function () {
    console.log('DOMContentLoaded');

    await startCamera();
    initializeCharacter();

    function waitForTmImage() {
        if (typeof tmImage !== 'undefined') {
            loadModel();
        } else {
            setTimeout(waitForTmImage, 100);
        }
    }
    waitForTmImage();

    document.querySelector('.next-btn').addEventListener('click', function () {
        clearInterval(timerInterval);
        nextCharacter();
    });
});