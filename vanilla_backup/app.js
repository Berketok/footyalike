const state = {
    apiKey: 'AIzaSyDGK_BlHcmaFaFPiKK390m7No19PkKByUM', // Hardcoded for demo
    currentImage: null, // Base64 string
    mode: 'upload'
};

// DOM Elements
const sections = {
    hero: document.getElementById('hero'),
    input: document.getElementById('input-section'),
    loading: document.getElementById('loading-section'),
    result: document.getElementById('result-section')
};

const tabs = {
    upload: document.getElementById('tab-upload'),
    camera: document.getElementById('tab-camera')
};

const views = {
    upload: document.getElementById('view-upload'),
    camera: document.getElementById('view-camera')
};

// Navigation / Init
document.getElementById('start-btn').addEventListener('click', () => {
    switchSection('input');
    checkApiKey();
});

document.getElementById('retry-btn').addEventListener('click', () => {
    state.currentImage = null;
    switchSection('input');
});

function switchSection(id) {
    Object.values(sections).forEach(el => el.classList.add('hidden'));
    sections[id].classList.remove('hidden');

    // Trigger animations if any
    sections[id].style.opacity = 0;
    requestAnimationFrame(() => {
        sections[id].style.opacity = 1;
    });

    if (id === 'input') {
        startCameraIfActive();
    } else {
        stopCamera();
    }
}

// Tabs
tabs.upload.addEventListener('click', () => setTab('upload'));
tabs.camera.addEventListener('click', () => setTab('camera'));

function setTab(mode) {
    state.mode = mode;

    // UI Updates
    tabs.upload.classList.toggle('active', mode === 'upload');
    tabs.camera.classList.toggle('active', mode === 'camera');

    views.upload.classList.toggle('active', mode === 'upload');
    views.upload.classList.toggle('hidden', mode !== 'upload');

    views.camera.classList.toggle('active', mode === 'camera');
    views.camera.classList.toggle('hidden', mode !== 'camera');

    if (mode === 'camera') startCamera();
    else stopCamera();
}

// Camera Logic
let stream = null;
const videoEl = document.getElementById('camera-feed');

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        videoEl.srcObject = stream;
    } catch (err) {
        console.error("Camera Error:", err);
        alert("Could not access camera. Please allow permissions or use upload.");
        setTab('upload');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

function startCameraIfActive() {
    if (state.mode === 'camera') startCamera();
}

document.getElementById('switch-camera-btn').addEventListener('click', async () => {
    // Simple toggle logic - in prod would check available devices
    stopCamera();
    // Re-request (browser usually cycles or we could specify deviceId)
    // For now, just restart to ensure it works
    startCamera();
});

// Debugging access
window.debugApp = { state, processImage, views, sections };

document.getElementById('capture-btn').addEventListener('click', () => {
    if (videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) {
        alert("Camera is not ready yet. Please wait a moment.");
        return;
    }

    const canvas = document.getElementById('camera-canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');

    // Flip horizontally for self-view natural feel if using front camera
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(videoEl, 0, 0);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    processImage(dataUrl);
});

// Upload Logic
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click()); // Allow clicking entire zone

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showError("Please upload a valid image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => processImage(e.target.result);
    reader.readAsDataURL(file);
}

// Processing Logic
async function processImage(base64Data) {
    state.currentImage = base64Data;
    switchSection('loading');

    // Clear previous errors
    hideError();

    // Minimum loading time for UX
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));

    try {
        const [result] = await Promise.all([
            identifyFootballer(base64Data),
            minLoadTime
        ]);

        if (result) {
            displayResult(result, base64Data);
        }
    } catch (err) {
        console.error("Processing flow error:", err);
        showError(err.message || "Something went wrong.");
        switchSection('input');
    }
}

function showError(msg) {
    alert(msg); // Fallback for now, could be better UI
}

function hideError() {
    // valid placeholder
}

// API Integration
function checkApiKey() {
    if (!state.apiKey) {
        const key = localStorage.getItem('gemini_api_key');
        if (key) {
            state.apiKey = key;
        } else {
            // Check if key is hardcoded 
            if (state.apiKey && state.apiKey.length > 10) return;

            const input = prompt("Please enter your Google Gemini API Key to continue:");
            if (input) {
                state.apiKey = input.trim();
                localStorage.setItem('gemini_api_key', state.apiKey);
            } else {
                alert("API Key is required.");
                switchSection('hero');
            }
        }
    }
}

async function identifyFootballer(base64Image) {
    const rawBase64 = base64Image.split(',')[1];
    if (!state.apiKey) throw new Error("API Key is missing.");

    const systemPrompt = `
    You are an expert football (soccer) analyst.
    Analyze the facial features of the person in this image.
    Identify which famous footballer they arguably look most similar to.
    Return a JSON object with this EXACT structure (no markdown, just raw json):
    {
        "name": "Name of Footballer",
        "similarity_score": "85", 
        "reasoning": "Short 1 sentence explanation of why, e.g. 'Both have similar eye shape and jawline.'"
    }
    If no face is detected or you can't tell, return { "error": "No face detected" }.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${state.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `API Error: ${response.statusText}`);
        }

        const data = await response.json();

        // Safety checks for candidate existence
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
            throw new Error("No analysis result returned. The image might be blocked by safety filters.");
        }

        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const result = JSON.parse(jsonStr);
            if (result.error) {
                throw new Error(result.error);
            }
            return result;
        } catch (e) {
            console.error("JSON Parse Error", e);
            throw new Error("Failed to parse AI response.");
        }

    } catch (err) {
        console.error("API Integration Error", err);
        throw err; // Re-throw to be caught in processImage
    }
}

function displayResult(data, userImage) {
    document.getElementById('result-user-img').src = userImage;

    // In a real app we might fetch the footballer's image via a search API.
    // For now we will rely on the UI placeholder or maybe try to generate/search if possible?
    // Let's just use a placeholder text for the footballer image or a generic icon.
    // Or we could try to ask Gemini for an image URL? No, Gemini text model doesn't return URLs reliably.
    // We'll leave the question mark or maybe set the name as text content.

    const placeholder = document.querySelector('.footballer-placeholder');
    // Simple trick: try to find an image from a public wiki or similar if we wanted, 
    // but for now let's just use initials.
    const initials = data.name.split(' ').map(n => n[0]).join('');
    placeholder.innerHTML = `<span style="font-size: 2rem; font-weight:bold;">${initials}</span>`;

    document.getElementById('match-name').textContent = data.name;
    document.getElementById('match-reasoning').textContent = data.reasoning;

    const score = parseInt(data.similarity_score);
    document.getElementById('similarity-score').textContent = `${score}% Match`;

    // Animate bar
    setTimeout(() => {
        document.getElementById('similarity-fill').style.width = `${score}%`;
    }, 100);

    switchSection('result');
}
