// Facial Similarity Service - Real face detection and comparison

let modelsLoaded = false;
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

// Load face-api.js models (only once)
export const loadFaceApiModels = async () => {
    if (modelsLoaded) return true;

    try {
        console.log('Loading face detection models...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        console.log('Face detection models loaded successfully!');
        return true;
    } catch (err) {
        console.error('Failed to load face-api models:', err);
        return false;
    }
};

// Detect face and extract descriptor from an image
export const detectFace = async (imageElement) => {
    if (!modelsLoaded) {
        await loadFaceApiModels();
    }

    try {
        const detection = await faceapi
            .detectSingleFace(imageElement)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            console.warn('No face detected in image');
            return null;
        }

        return detection.descriptor; // 128-dimensional array
    } catch (err) {
        console.error('Face detection error:', err);
        return null;
    }
};

// Calculate similarity between two face descriptors
export const calculateSimilarity = (descriptor1, descriptor2) => {
    if (!descriptor1 || !descriptor2) {
        return null;
    }

    // Calculate Euclidean distance
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);

    // Convert distance to similarity percentage (0-100%)
    // Distance typically ranges from 0 (identical) to ~1.2 (very different)
    // We'll map: 0 → 100%, 0.6 → 0%
    const similarity = Math.max(0, Math.min(100, (1 - distance / 0.6) * 100));

    return Math.round(similarity);
};

// Helper: Load image from URL into an Image element
export const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Enable CORS
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
    });
};

// Helper: Load image from base64 data URL
export const loadImageFromBase64 = (base64) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = base64;
    });
};

// Main function: Compare user image with footballer image
export const compareFaces = async (userBase64, footballerImageUrl) => {
    try {
        console.log('Loading images for comparison...');

        // Load both images
        const userImg = await loadImageFromBase64(userBase64);
        const footballerImg = await loadImage(footballerImageUrl);

        console.log('Detecting faces...');

        // Detect faces
        const userDescriptor = await detectFace(userImg);
        const footballerDescriptor = await detectFace(footballerImg);

        if (!userDescriptor) {
            throw new Error('No face detected in your photo');
        }

        if (!footballerDescriptor) {
            console.warn('No face detected in footballer image, trying alternative...');
            return null; // Caller should try alternative image
        }

        // Calculate similarity
        const similarity = calculateSimilarity(userDescriptor, footballerDescriptor);

        console.log('Facial similarity calculated:', similarity + '%');
        return similarity;

    } catch (err) {
        console.error('Face comparison error:', err);
        throw err;
    }
};
