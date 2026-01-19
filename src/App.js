import React, { useState, useCallback, useRef } from 'react';
import Camera from './components/Camera.js';
import ResultDisplay from './components/ResultDisplay.js';
import { AppState } from './types.js';
import { analyzeFaceMatch } from './services/geminiService.js';

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
            {/* Navigation */}
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

            {/* Dynamic Content */}
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

            {/* Footer Branding */}
            <footer className="p-6 md:p-8 text-center text-[8px] md:text-[10px] font-black tracking-[0.4em] md:tracking-[0.6em] text-slate-700 uppercase border-t border-white/5 bg-black/20">
                Proprietary Scouting AI Vision Engine v4.2.0
            </footer>
        </div>
    );
};

export default App;
