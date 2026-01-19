const { useState, useCallback, useRef, useEffect } = React;
const { createRoot } = ReactDOM;

// --- types.js ---
const AppState = {
    IDLE: 'IDLE',
    CAPTURING: 'CAPTURING',
    ANALYZING: 'ANALYZING',
    RESULT: 'RESULT',
    ERROR: 'ERROR'
};

// --- imageSearchService.js (Inline) ---
const IMAGE_SEARCH_QUOTA_KEY = 'footballer_search_quota';
const DAILY_LIMIT = 100;

const getSearchQuota = () => {
    const stored = localStorage.getItem(IMAGE_SEARCH_QUOTA_KEY);
    if (!stored) {
        return { date: new Date().toISOString().split('T')[0], count: 0, limit: DAILY_LIMIT };
    }
    const quota = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];
    if (quota.date !== today) {
        return { date: today, count: 0, limit: DAILY_LIMIT };
    }
    return quota;
};

const incrementSearchCount = () => {
    const quota = getSearchQuota();
    quota.count += 1;
    localStorage.setItem(IMAGE_SEARCH_QUOTA_KEY, JSON.stringify(quota));
    return quota;
};

const hasQuotaRemaining = () => {
    const quota = getSearchQuota();
    return quota.count < quota.limit;
};

const searchWikimedia = async (playerName) => {
    try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + ' footballer')}&format=json&origin=*`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchData.query || !searchData.query.search || searchData.query.search.length === 0) {
            return null;
        }

        const pageTitle = searchData.query.search[0].title;
        const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const imageResponse = await fetch(imageUrl);
        const imageData = await imageResponse.json();

        const pages = imageData.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pages[pageId].thumbnail) {
            return pages[pageId].thumbnail.source;
        }
        return null;
    } catch (err) {
        console.error('Wikimedia search error:', err);
        return null;
    }
};

const fetchFootballerImage = async (playerName) => {
    console.log('Searching for footballer image:', playerName);
    const imageUrl = await searchWikimedia(playerName);
    if (!imageUrl) {
        console.warn('Could not find image for', playerName);
    }
    return imageUrl;
};

// --- Player Stats Service ---
const fetchPlayerStats = async (playerName) => {
    try {
        console.log('📊 Fetching real stats for:', playerName);

        // Try to get stats from Wikipedia infobox
        try {
            const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=${encodeURIComponent(playerName)}&origin=*`;
            const response = await fetch(wikiUrl);
            const data = await response.json();

            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];

            if (pageId !== '-1' && pages[pageId].revisions) {
                const content = pages[pageId].revisions[0]['*'];

                // Try to parse infobox statistics
                const stats = {
                    appearances: null,
                    goals: null,
                    assists: null
                };

                // Look for career stats patterns in Wikipedia content
                // Format: | caps = 123 or | totalcaps = 123
                const capsMatch = content.match(/\|\s*(?:total)?caps\s*=\s*(\d+)/i);
                if (capsMatch) stats.appearances = capsMatch[1];

                // Format: | goals = 123 or | totalgoals = 123
                const goalsMatch = content.match(/\|\s*(?:total)?goals\s*=\s*(\d+)/i);
                if (goalsMatch) stats.goals = goalsMatch[1];

                // Assists are less commonly in Wikipedia infoboxes
                const assistsMatch = content.match(/\|\s*(?:total)?assists?\s*=\s*(\d+)/i);
                if (assistsMatch) stats.assists = assistsMatch[1];

                // If we found at least some stats, return them
                if (stats.appearances || stats.goals) {
                    // Fill in missing values
                    if (!stats.appearances) stats.appearances = 'N/A';
                    if (!stats.goals) stats.goals = 'N/A';
                    if (!stats.assists) stats.assists = 'N/A';

                    console.log('✅ Stats fetched from Wikipedia:', stats);
                    return stats;
                }
            }
        } catch (err) {
            console.warn('Wikipedia stats parsing failed:', err.message);
        }

        // If Wikipedia didn't work, return null so Gemini's estimates are used
        console.log('⚠️ Could not fetch detailed stats, using AI estimates');
        return null;

    } catch (err) {
        console.error('Stats fetching error:', err);
        return null;
    }
};

// --- similarityService.js (Inline) ---
let modelsLoaded = false;
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';


const loadFaceApiModels = async () => {
    if (modelsLoaded) return true;
    try {
        console.log('Loading face detection models...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        console.log('Face detection models loaded!');
        return true;
    } catch (err) {
        console.error('Failed to load face-api models:', err);
        return false;
    }
};

const detectFace = async (imageElement) => {
    if (!modelsLoaded) await loadFaceApiModels();
    try {
        const detection = await faceapi
            .detectSingleFace(imageElement)
            .withFaceLandmarks()
            .withFaceDescriptor();
        return detection ? detection.descriptor : null;
    } catch (err) {
        console.error('Face detection error:', err);
        return null;
    }
};

const calculateSimilarity = (descriptor1, descriptor2) => {
    if (!descriptor1 || !descriptor2) return null;
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    const similarity = Math.max(0, Math.min(100, (1 - distance / 0.6) * 100));
    return Math.round(similarity);
};

const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
    });
};

const loadImageFromBase64 = (base64) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = base64;
    });
};

const compareFaces = async (userBase64, footballerImageUrl) => {
    try {
        const userImg = await loadImageFromBase64(userBase64);
        const footballerImg = await loadImage(footballerImageUrl);

        const userDescriptor = await detectFace(userImg);
        const footballerDescriptor = await detectFace(footballerImg);

        if (!userDescriptor) throw new Error('No face detected in your photo');
        if (!footballerDescriptor) return null;

        return calculateSimilarity(userDescriptor, footballerDescriptor);
    } catch (err) {
        console.error('Face comparison error:', err);
        throw err;
    }
};

// --- geminiService.js ---
const analyzeFaceMatch = async (base64Image) => {
    try {
        const apiKey = localStorage.getItem('gemini_api_key') || 'AIzaSyDGK_BlHcmaFaFPiKK390m7No19PkKByUM';
        const rawBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

        if (!apiKey || apiKey.length < 10) {
            console.warn("Invalid API Key, switching to simulation.");
            throw new Error("Invalid API Key");
        }

        const systemPrompt = `
        You are an expert football (soccer) analyst.
        Analyze the facial features of the person in this image.
        Identify which famous footballer they look most similar to.
        
        CRITICAL: YOU MUST ALWAYS RETURN A MATCH. NEVER RETURN AN ERROR.
        If the face is unclear, make your best guess based on available features (hair, jawline, etc.).
        
        Return a JSON object with this EXACT structure (no markdown, just raw json):
        {
            "playerName": "Name of Footballer",
            "similarityScore": 85, 
            "club": "Current Club",
            "position": "Position (e.g. Forward)",
            "reasoning": "Short 1 sentence explanation of why.",
            "stats": {
                "appearances": "100+",
                "goals": "50+",
                "assists": "30+"
            }
        }
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
                    ]
                }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

        const data = await response.json();
        if (!data.candidates || !data.candidates[0].content) {
            throw new Error("No analysis result returned (blocked or empty).");
        }

        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonStr);
        if (result.error) throw new Error(result.error);

        // STEP 2: Fetch footballer image
        console.log('🔍 Fetching image for:', result.playerName);
        const footballerImageUrl = await fetchFootballerImage(result.playerName);

        // STEP 3: Fetch real player stats
        const realStats = await fetchPlayerStats(result.playerName);
        if (realStats) {
            result.stats = realStats;
        }

        if (footballerImageUrl) {
            // STEP 4: Calculate REAL similarity
            console.log('🧬 Calculating facial similarity...');
            try {
                const realSimilarity = await compareFaces(base64Image, footballerImageUrl);
                if (realSimilarity !== null) {
                    console.log('✅ Real similarity:', realSimilarity + '%');
                    result.similarityScore = realSimilarity;
                    result.playerImageUrls = [footballerImageUrl];
                    result.reasoning = `Based on facial feature analysis: ${result.reasoning}`;
                } else {
                    // No face in footballer image, keep Gemini's score
                    result.playerImageUrls = [footballerImageUrl];
                }
            } catch (err) {
                console.warn('Similarity calculation failed, using Gemini estimate:', err.message);
                result.playerImageUrls = footballerImageUrl ? [footballerImageUrl] : [];
            }
        } else {
            result.playerImageUrls = [];
        }

        return result;

    } catch (err) {
        console.error("Gemini API Error, switching to FALLBACK simulation:", err);

        const fallbacks = [
            {
                playerName: "Lionel Messi",
                similarityScore: 94,
                club: "Inter Miami",
                position: "Forward",
                reasoning: "Your determined expression mirrors the focus of the GOAT himself. Neural backup activated.",
                stats: { appearances: "1047", goals: "821", assists: "361" },
                playerImageUrls: ["https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Lionel_Messi_20180626.jpg/420px-Lionel_Messi_20180626.jpg"]
            },
            {
                playerName: "Cristiano Ronaldo",
                similarityScore: 93,
                club: "Al Nassr",
                position: "Forward",
                reasoning: "The confidence in your stance is an exact match for CR7's legendary pose.",
                stats: {
                    appearances: "1200+", goals: "870+", assists: "250+"
                },
                playerImageUrls: ["https://upload.wikimedia.org/wikipedia/commons/8/8c/Cristiano_Ronaldo_2018.jpg"]
            },
            {
                playerName: "Zinedine Zidane",
                similarityScore: 91,
                club: "Retired (Legend)",
                position: "Midfielder",
                reasoning: "A calm, commanding aura detected. You share the elegance of Zizou.",
                stats: { appearances: "600+", goals: "120+", assists: "110+" },
                playerImageUrls: ["https://upload.wikimedia.org/wikipedia/commons/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg"]
            }
        ];

        const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        return randomFallback;
    }
};
// --- Camera.js ---
const Camera = ({ onCapture, onCancel }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        let stream = null;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                alert("Camera access denied. Check your permissions.");
                onCancel();
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [onCancel]);

    const capture = useCallback(() => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                onCapture(dataUrl);
            }
        }
    }, [onCapture]);

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-4">
            <div className="relative w-full max-w-md aspect-[3/4] bg-neutral-900 rounded-[2rem] md:rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(34,197,94,0.1)] border-2 border-white/10">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                />

                <div className="absolute inset-0 border border-white/5 pointer-events-none">
                    <div className="absolute top-8 left-8 w-10 h-10 border-t-4 border-l-4 border-green-500/80 rounded-tl-xl"></div>
                    <div className="absolute top-8 right-8 w-10 h-10 border-t-4 border-r-4 border-green-500/80 rounded-tr-xl"></div>
                    <div className="absolute bottom-8 left-8 w-10 h-10 border-b-4 border-l-4 border-green-500/80 rounded-bl-xl"></div>
                    <div className="absolute bottom-8 right-8 w-10 h-10 border-b-4 border-r-4 border-green-500/80 rounded-br-xl"></div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-72 md:w-64 md:h-80 border border-white/20 rounded-[5rem] flex items-center justify-center">
                        <div className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,1)]"></div>
                    </div>

                    <div className="absolute top-12 left-1/2 -translate-x-1/2 text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] text-white/40 italic">
                        Facial Locking Active
                    </div>
                </div>
            </div>

            <div className="w-full max-w-md mt-10 md:mt-12 flex items-center justify-between px-6">
                <button
                    onClick={onCancel}
                    className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                    <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <button
                    onClick={capture}
                    className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-full border-[6px] md:border-[8px] border-white/20 shadow-2xl active:scale-90 transition-transform flex items-center justify-center"
                >
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-green-500 rounded-full border-4 border-white"></div>
                </button>
                <div className="w-14 h-14 md:w-16 md:h-16"></div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

// --- ResultDisplay.js ---
const ResultDisplay = ({ match, userImage, onReset }) => {
    const cardRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [proImageLoaded, setProImageLoaded] = useState(false);
    const [showGallery, setShowGallery] = useState(false);

    const playerImageUrls = match.playerImageUrls || [];

    useEffect(() => {
        if (window.google?.search?.cse?.element) {
            const element = window.google.search.cse.element.getElement('scout-search');
            if (element) {
                element.execute(`site:transfermarkt.com ${match.playerName} portrait`);
            }
        }
    }, [match]);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsProcessing('download');
        try {
            await new Promise(r => setTimeout(r, 800));
            const canvas = await window.html2canvas(cardRef.current, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#0f172a',
                scale: 2
            });
            const link = document.createElement('a');
            link.download = `scout-report-${match.playerName.toLowerCase().replace(/\s+/g, '-')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) { console.error(err); } finally { setIsProcessing(null); }
    };

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-4 md:py-8 animate-in fade-in zoom-in duration-700">
            <div
                ref={cardRef}
                className="relative bg-[#0f172a] rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.9)] overflow-hidden mb-8 md:mb-10"
            >
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 pointer-events-none"></div>

                <div className="relative z-10">
                    <header className="flex flex-col md:flex-row justify-between items-center md:items-start gap-6 mb-10 md:mb-12">
                        <div className="flex items-center gap-4 md:gap-5 self-start">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-green-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                                <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-white font-black uppercase tracking-tighter text-2xl md:text-3xl italic leading-none">Scout Intelligence</h2>
                                <div className="flex items-center gap-2 mt-1 md:mt-2">
                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse bg-green-500`}></span>
                                    <span className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] md:tracking-[0.4em]">
                                        Intel Sync Active
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 px-6 md:px-8 py-3 md:py-4 rounded-2xl md:rounded-[2rem] flex flex-col items-center shadow-2xl self-center md:self-auto">
                            <span className="text-4xl md:text-5xl font-black text-yellow-500 italic leading-none tracking-tighter">{match.similarityScore}%</span>
                            <span className="text-[8px] md:text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Similarity</span>
                        </div>
                    </header>

                    <div className="flex flex-col lg:flex-row gap-8 md:gap-12 lg:items-stretch mb-8 md:mb-10">
                        <div className="relative flex-1 group min-h-[360px] md:min-h-[480px]">
                            <div className="flex h-full rounded-[2rem] md:rounded-[3rem] overflow-hidden border-2 border-white/10 shadow-3xl bg-neutral-900">
                                <div className="relative flex-1 border-r border-white/10">
                                    <img src={userImage} className="w-full h-full object-cover grayscale brightness-110 contrast-125" alt="Candidate" />
                                    <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 bg-black/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[7px] md:text-[8px] font-black uppercase text-white border border-white/10 tracking-widest">Candidate</div>
                                </div>

                                <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden">
                                    {playerImageUrls.length > 0 ? (
                                        <img src={playerImageUrls[0]} className="w-full h-full object-cover" alt={match.playerName} />
                                    ) : (
                                        <>
                                            {!proImageLoaded && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-10 transition-opacity duration-500" style={{ opacity: proImageLoaded ? 0 : 1 }}>
                                                    <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-3"></div>
                                                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Retrieving Asset</span>
                                                </div>
                                            )}

                                            <div className="flex flex-col items-center justify-center text-center p-4">
                                                <span className="text-4xl mb-2">⚽</span>
                                                <span className="text-xs text-slate-500 font-bold uppercase">{match.playerName}</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="absolute bottom-4 md:bottom-6 right-4 md:right-6 bg-yellow-500 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[7px] md:text-[8px] font-black uppercase text-black border border-black/20 shadow-xl z-10 italic tracking-widest">Target Feed</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                            <div className="space-y-6 md:space-y-8">
                                <div>
                                    <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter text-white leading-[0.9] mb-4 uppercase">
                                        {match.playerName}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                        <span className="bg-white/10 text-white/90 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-white/5">{match.club}</span>
                                        <span className="text-yellow-500 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[9px] md:text-[10px]">{match.position}</span>
                                    </div>
                                </div>

                                {match.stats && (
                                    <div className="grid grid-cols-3 gap-3 md:gap-4 bg-white/[0.03] border border-white/10 rounded-2xl md:rounded-[2rem] p-5 md:p-6 backdrop-blur-2xl">
                                        <div className="text-center">
                                            <div className="text-2xl md:text-3xl font-black text-white italic tracking-tighter">{match.stats.appearances}</div>
                                            <div className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Apps</div>
                                        </div>
                                        <div className="text-center border-x border-white/10 px-1 md:px-2">
                                            <div className="text-2xl md:text-3xl font-black text-green-500 italic tracking-tighter">{match.stats.goals}</div>
                                            <div className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Goals</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl md:text-3xl font-black text-white italic tracking-tighter">{match.stats.assists}</div>
                                            <div className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Assists</div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-gradient-to-r from-yellow-500/10 to-transparent border-l-4 border-yellow-500 p-5 md:p-6 rounded-r-2xl">
                                    <p className="text-slate-300 text-sm md:text-base leading-relaxed italic font-medium">"{match.reasoning}"</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 bg-white/5 rounded-[2rem] p-6 md:p-8 border border-white/10 overflow-hidden transition-all duration-700">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                <h3 className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.3em]">Scouting Archive</h3>
                            </div>
                            <button
                                onClick={() => setShowGallery(!showGallery)}
                                className={`w-full sm:w-auto text-[9px] font-black uppercase px-6 py-2.5 rounded-full transition-all border ${showGallery ? 'bg-white text-[#0f172a] border-white' : 'text-slate-500 border-white/10 hover:border-white/30'}`}
                            >
                                {showGallery ? 'Hide Gallery' : 'Deep Scan Gallery'}
                            </button>
                        </div>

                        <div className={`${showGallery ? 'block' : 'hidden'} mt-8 animate-in fade-in slide-in-from-top-2 duration-500`} style={{ minHeight: '400px' }}>
                            <div className="gcse-search" data-gname="scout-search"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-center justify-center px-4">
                <button
                    onClick={handleDownload}
                    disabled={isProcessing === 'download'}
                    className="w-full sm:w-auto px-10 md:px-12 py-5 md:py-6 bg-white text-[#0f172a] rounded-2xl md:rounded-[2rem] font-black text-lg md:text-xl uppercase tracking-tighter flex items-center justify-center gap-4 shadow-2xl transition-all hover:scale-105 active:scale-95 hover:bg-green-500 hover:text-white"
                >
                    {isProcessing === 'download' ? 'Exporting...' : 'Export Report'}
                </button>
                <button
                    onClick={onReset}
                    className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-500 font-black uppercase tracking-widest text-[10px] md:text-xs hover:text-white transition-all text-center"
                >
                    New Scan
                </button>
            </div>
        </div>
    );
};

// --- App.js ---
const App = () => {
    const [state, setState] = useState(AppState.IDLE);
    const [capturedImage, setCapturedImage] = useState(null);
    const [matchResult, setMatchResult] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleStartScouting = () => {
        setState(AppState.CAPTURING);
        setError(null);
    };

    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result;
                handleCapture(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCapture = useCallback(async (image) => {
        setCapturedImage(image);
        setState(AppState.ANALYZING);

        try {
            const result = await analyzeFaceMatch(image);
            setMatchResult(result);
            setState(AppState.RESULT);
        } catch (err) {
            console.error(err);
            setError("The scanner couldn't find a match. Try better lighting.");
            setState(AppState.ERROR);
        }
    }, []);

    const handleReset = () => {
        setState(AppState.IDLE);
        setCapturedImage(null);
        setMatchResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col font-['Inter']">
            <nav className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between backdrop-blur-xl sticky top-0 z-40 bg-[#020617]/80">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-green-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                        <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12d1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <span className="text-xl md:text-2xl font-black uppercase tracking-tighter italic">FootyLookalike</span>
                </div>
                {state === AppState.RESULT && (
                    <button
                        onClick={handleReset}
                        className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors"
                    >
                        Reset
                    </button>
                )}
            </nav>

            <main className="flex-1 flex flex-col items-center justify-center">
                {state === AppState.IDLE && (
                    <div className="w-full max-w-4xl text-center px-6 py-12 md:py-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="inline-block mb-6 px-4 md:px-6 py-1.5 md:py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] md:tracking-[0.5em]">
                            Next-Gen Vision Scouting
                        </div>
                        <h1 className="text-5xl sm:text-7xl md:text-9xl font-black mb-6 md:mb-8 tracking-tighter leading-[0.9] italic uppercase">
                            REVEAL YOUR <span className="text-green-500">PRO TWIN.</span>
                        </h1>
                        <p className="text-base md:text-xl text-slate-400 mb-10 md:mb-12 leading-relaxed font-medium max-w-2xl mx-auto px-4">
                            Identify your professional football lookalike using advanced biometric scouting.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center w-full max-w-md mx-auto sm:max-w-none">
                            <button
                                onClick={handleStartScouting}
                                className="w-full sm:w-auto group relative px-8 md:px-12 py-5 md:py-7 bg-green-500 text-[#0f172a] font-black text-xl md:text-2xl rounded-2xl md:rounded-3xl transition-all hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(34,197,94,0.2)] flex items-center justify-center gap-3 md:gap-4"
                            >
                                <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                INITIATE SCAN
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full sm:w-auto px-8 md:px-12 py-5 md:py-7 bg-white/5 border-2 border-white/10 text-white font-black text-xl md:text-2xl rounded-2xl md:rounded-3xl transition-all hover:bg-white/10 active:scale-95 flex items-center justify-center gap-3 md:gap-4"
                            >
                                <svg className="w-6 h-6 md:w-8 md:h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                UPLOAD PHOTO
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        <div className="mt-16 md:mt-20 flex items-center justify-center gap-4 md:gap-8 opacity-20 grayscale">
                            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl border-2 border-white/20 bg-slate-800"></div>
                            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl border-2 border-white/20 bg-slate-800"></div>
                            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl border-2 border-white/20 bg-slate-800"></div>
                            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl border-2 border-white/20 bg-slate-800"></div>
                        </div>
                    </div>
                )}

                {state === AppState.CAPTURING && (
                    <Camera onCapture={handleCapture} onCancel={handleReset} />
                )}

                {state === AppState.ANALYZING && capturedImage && (
                    <div className="flex flex-col items-center text-center p-6 w-full max-w-lg animate-in fade-in duration-500">
                        <div className="relative w-full max-w-[320px] md:max-w-none aspect-[3/4] rounded-[2.5rem] md:rounded-[3rem] overflow-hidden mb-10 md:mb-12 shadow-[0_0_80px_rgba(34,197,94,0.15)] border-2 md:border-4 border-green-500/20">
                            <img
                                src={capturedImage}
                                alt="Prospect"
                                className="w-full h-full object-cover brightness-50 contrast-125"
                            />
                            <div className="absolute inset-0 scanner-line h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent shadow-[0_0_30px_rgba(34,197,94,1)]"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-20 h-20 md:w-28 md:h-28 border-4 md:border-8 border-white/5 border-t-green-500 rounded-full animate-spin"></div>
                            </div>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black mb-3 md:mb-4 animate-pulse uppercase tracking-tighter italic text-green-500">Analyzing Intel</h2>
                        <p className="text-slate-500 font-black uppercase text-[10px] md:text-xs tracking-[0.4em] md:tracking-[0.5em]">Synchronizing Landmarks...</p>

                        <div className="mt-8 md:mt-12 grid grid-cols-2 gap-3 md:gap-4 w-full text-[8px] md:text-[10px] text-slate-600 font-black uppercase tracking-widest border-t border-white/5 pt-6 md:pt-8">
                            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> UEFA SYNC</div>
                            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> FIFA ASSETS</div>
                            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> FACE MESH</div>
                            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> SCOUT LOCK</div>
                        </div>
                    </div>
                )}

                {state === AppState.RESULT && matchResult && capturedImage && (
                    <ResultDisplay
                        match={matchResult}
                        userImage={capturedImage}
                        onReset={handleReset}
                    />
                )}

                {state === AppState.ERROR && (
                    <div className="max-w-xs md:max-w-md text-center p-8 md:p-12 animate-in zoom-in duration-300 bg-red-500/5 rounded-[2.5rem] md:rounded-[3rem] border border-red-500/10">
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 border border-red-500/20">
                            <svg className="w-8 h-8 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black mb-6 uppercase tracking-tighter">{error}</h2>
                        <button
                            onClick={handleReset}
                            className="w-full px-8 py-4 bg-white text-black font-black rounded-xl md:rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs md:text-sm"
                        >
                            Restart Scanner
                        </button>
                    </div>
                )}
            </main>

            <footer className="p-6 md:p-8 text-center text-[8px] md:text-[10px] font-black tracking-[0.4em] md:tracking-[0.6em] text-slate-700 uppercase border-t border-white/5 bg-black/20">
                Proprietary Scouting AI Vision Engine v4.2.0
                <span
                    onClick={triggerAntigravity}
                    className="ml-4 opacity-50 hover:opacity-100 hover:text-green-500 cursor-pointer transition-all"
                    title="Activate Zero-G Protocol"
                >
                    [AG-PROTOCOL]
                </span>
            </footer>
        </div>
    );
};

// --- Antigravity.js (Easter Egg) ---
class AntigravityEffect {
    constructor() {
        this.bodies = [];
        this.animationId = null;
        this.gravity = 0.5;
        this.bounceFactor = 0.6;
        this.friction = 0.99;
        this.floorY = window.innerHeight - 20;
    }

    activate(selector = '*') {
        // Get all visible elements
        const elements = document.querySelectorAll(selector);

        elements.forEach((el) => {
            // Skip body, html, scripts, styles, and the canvas itself if valid
            // Also skip the root container to avoid destroying the entire page format instantly
            // We target leaf nodes or specific interactive elements for best effect
            if (
                el.tagName === 'BODY' ||
                el.tagName === 'HTML' ||
                el.tagName === 'SCRIPT' ||
                el.tagName === 'STYLE' ||
                el.tagName === 'HEAD' ||
                el.id === 'root' ||
                el.children.length > 0 // Only leaf nodes
            ) {
                return;
            }

            const rect = el.getBoundingClientRect();

            // Skip invisible or tiny elements
            if (rect.width < 5 || rect.height < 5) return;

            // Make element physically independent
            el.style.position = 'fixed';
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.top}px`;
            el.style.width = `${rect.width}px`;
            el.style.height = `${rect.height}px`;
            el.style.margin = '0';
            el.style.transition = 'none';
            el.style.zIndex = '9999';
            el.style.transformOrigin = 'center center';

            this.bodies.push({
                element: el,
                x: rect.left,
                y: rect.top,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                width: rect.width,
                height: rect.height,
                rotation: 0,
                angularVelocity: (Math.random() - 0.5) * 20,
            });
        });

        this.startSimulation();
    }

    startSimulation() {
        const update = () => {
            this.bodies.forEach((body) => {
                // Apply gravity
                body.vy += this.gravity;

                // Apply velocity
                body.x += body.vx;
                body.y += body.vy;

                // Apply friction
                body.vx *= this.friction;

                // Rotate
                body.rotation += body.angularVelocity;
                body.angularVelocity *= 0.98;

                // Floor collision
                if (body.y + body.height > this.floorY) {
                    body.y = this.floorY - body.height;
                    body.vy *= -this.bounceFactor;
                    body.angularVelocity *= 0.8;

                    // Stop if barely moving
                    if (Math.abs(body.vy) < 1) {
                        body.vy = 0;
                    }
                }

                // Wall collisions
                if (body.x < 0) {
                    body.x = 0;
                    body.vx *= -this.bounceFactor;
                }
                if (body.x + body.width > window.innerWidth) {
                    body.x = window.innerWidth - body.width;
                    body.vx *= -this.bounceFactor;
                }

                // Update DOM
                body.element.style.left = `${body.x}px`;
                body.element.style.top = `${body.y}px`;
                body.element.style.transform = `rotate(${body.rotation}deg)`;
            });

            this.animationId = requestAnimationFrame(update);
        };

        update();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

const triggerAntigravity = () => {
    const effect = new AntigravityEffect();
    effect.activate('p, h1, h2, h3, span, button, img, a, div, li, svg, input');
};

const root = createRoot(document.getElementById('root'));
root.render(<App triggerAntigravity={triggerAntigravity} />);
