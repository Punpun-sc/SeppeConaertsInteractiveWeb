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
let matchTimer = 0;
let currentRequestedRomaji = '';
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
        // Get all video input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Use the first real camera (usually the default system camera)
        let constraints = { video: { facingMode: 'user' } };
        
        if (videoDevices.length > 0) {
            // Use the first video device's ID for the default system camera
            constraints = { video: { deviceId: { exact: videoDevices[0].deviceId }, facingMode: 'user' } };
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        console.log('camera gestart');
    } catch (err) {
        console.error('camera fout:', err);
        // Fallback to any available camera if the specific one fails
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            console.log('camera gestart (fallback)');
        } catch (fallbackErr) {
            cameraBox.innerHTML = '<p style="color:red;padding:1rem;">Camera geblokkeerd: ' + fallbackErr.message + '</p>';
        }
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

    // Check if recognized character matches requested character and confidence >= 50%
    const isCorrectMatch = best.className === currentRequestedRomaji && confidence >= 50;
    
    if (isCorrectMatch) {
        matchTimer += 16; // Approximately 1 frame ~16ms
        if (matchTimer >= 2000) { // 2 seconds
            points++;
            updateScoreDisplay();
            matchTimer = 0;
            nextCharacter(); // Show next character
        }
    } else {
        matchTimer = 0;
    }

    // Zoek het bijbehorende hiragana karakter
    const match = hiraganaSet.find(h => h.romaji === best.className);
    const hiraganaChar = match ? match.char : '?';

    // Toon in answer-box
    const isMatching = best.className === currentRequestedRomaji;
    labelContainer.innerHTML = `
        <p style="margin:0 0 8px 0; font-size: 14px; color: #555;">Herkend karakter:</p>
        <div style="font-size: 80px; line-height: 1; text-align: center;">${hiraganaChar}</div>
        <div style="text-align: center; font-size: 18px; margin-top: 8px;">${best.className}</div>
        <div style="text-align: center; font-size: 14px; color: ${isMatching && confidence >= 50 ? '#2d6a2d' : '#777'}; margin-top: 4px; font-weight: ${isMatching && confidence >= 50 ? 'bold' : 'normal'}">${confidence.toFixed(1)}% zeker</div>
        ${isMatching ? `<div style="text-align: center; font-size: 12px; color: #2d6a2d; margin-top: 6px;">✓ Correct! (${(matchTimer / 2000 * 100).toFixed(0)}%)</div>` : ''}
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
    currentRequestedRomaji = character.romaji;
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
    
    const finalScore = points;
    const playerName = prompt('Voer je naam in om je score op te slaan:');
    
    if (playerName === null) return; // User cancelled
    
    saveScore(playerName || 'Anoniem');
    
    displayFinalResults(finalScore);
}

function saveScore(name) {
    const scores = JSON.parse(localStorage.getItem('hiraganaScores')) || [];
    scores.push({
        name: name,
        score: points,
        date: new Date().toLocaleDateString('nl-NL')
    });
    localStorage.setItem('hiraganaScores', JSON.stringify(scores));
}

function displayFinalResults(finalScore) {
    const allScores = JSON.parse(localStorage.getItem('hiraganaScores')) || [];
    
    let scoresHTML = '<h3 style="font-size: 20px; margin-bottom: 15px; color: #333;">Alle Scores:</h3>';
    scoresHTML += '<div style="max-height: 300px; overflow-y: auto; background: #f0f0f0; padding: 10px; border-radius: 8px;">';
    
    if (allScores.length === 0) {
        scoresHTML += '<p style="color: #666;">Geen scores opgeslagen.</p>';
    } else {
        scoresHTML += '<table style="width: 100%; border-collapse: collapse;">';
        scoresHTML += '<tr style="background: #d6d6d6; font-weight: bold;"><td style="padding: 8px; border-bottom: 1px solid #999;">Naam</td><td style="padding: 8px; border-bottom: 1px solid #999; text-align: center;">Score</td><td style="padding: 8px; border-bottom: 1px solid #999; text-align: center;">Datum</td></tr>';
        
        allScores.slice().reverse().forEach((entry, index) => {
            const bgColor = index % 2 === 0 ? '#fff' : '#efefef';
            scoresHTML += `<tr style="background: ${bgColor};"><td style="padding: 8px; border-bottom: 1px solid #ddd;">${entry.name}</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${entry.score}</td><td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${entry.date}</td></tr>`;
        });
        
        scoresHTML += '</table>';
    }
    
    scoresHTML += '</div>';
    
    document.querySelector('.prompt').innerHTML = `
        <h2 style="font-size: 36px; margin-bottom: 20px;">🎉 Spel Voorbij! 🎉</h2>
        <p style="font-size: 24px; margin: 15px 0; color: #2d6a2d;">Jouw Score: <strong>${finalScore}</strong></p>
        ${scoresHTML}
    `;
    
    document.querySelector('.answer-box').innerHTML = `
        <p style="color: #666; text-align: center; padding: 20px;">Klik op "Volgende" om opnieuw te spelen</p>
    `;
}

function resetGame() {
    points = 0;
    matchTimer = 0;
    currentRequestedRomaji = '';
    gameActive = true;
    shuffledSet = shuffleArray(hiraganaSet);
    currentIndex = 0;
    updateScoreDisplay();
    displayCharacter();
    startTimer();
}

function nextCharacter() {
    currentIndex++;
    if (currentIndex >= shuffledSet.length) {
        shuffledSet = shuffleArray(hiraganaSet);
        currentIndex = 0;
    }
    displayCharacter();
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
        if (gameActive) {
            nextCharacter();
        } else {
            resetGame();
        }
    });
});