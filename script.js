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
let timeLeft = 10;
let timerInterval = null;
let model, webcam, labelContainer, maxPredictions;
let modelURL = 'https://teachablemachine.withgoogle.com/models/2dsWbG2qE/';

let mirrorCanvas, mirrorCtx;

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
    if (!model || !mirrorCanvas) return;

    const prediction = await model.predict(mirrorCanvas);

    // Zoek het karakter met de hoogste zekerheid
    let best = prediction[0];
    for (let i = 1; i < prediction.length; i++) {
        if (prediction[i].probability > best.probability) {
            best = prediction[i];
        }
    }

    const confidence = (best.probability * 100).toFixed(1);
    console.log(`Herkend: ${best.className} (${confidence}%)`);

    // Zoek het bijbehorende hiragana karakter
    const match = hiraganaSet.find(h => h.romaji === best.className);
    const hiraganaChar = match ? match.char : '?';

    // Toon in answer-box
    labelContainer.innerHTML = `
        <p style="margin:0 0 8px 0; font-size: 14px; color: #555;">Herkend karakter:</p>
        <div style="font-size: 80px; line-height: 1; text-align: center;">${hiraganaChar}</div>
        <div style="text-align: center; font-size: 18px; margin-top: 8px;">${best.className}</div>
        <div style="text-align: center; font-size: 14px; color: #777; margin-top: 4px;">${confidence}% zeker</div>
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
    timeLeft = 10;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            nextCharacter();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const el = document.querySelector('.time');
    el.innerHTML = `Tijd: ${timeLeft}s`;
    el.style.background = timeLeft <= 3 ? '#8b3a3a' : '#6a2c2c';
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