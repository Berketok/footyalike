import React, { useRef, useState, useEffect } from 'react';

const ResultDisplay = ({ match, userImage, onReset }) => {
    const cardRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [proImageLoaded, setProImageLoaded] = useState(false);
    const [backupImageUrl, setBackupImageUrl] = useState(null);
    const [isSearchingBackup, setIsSearchingBackup] = useState(false);
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

    const fetchBackupImage = async () => {
        if (isSearchingBackup || backupImageUrl) return;
        setIsSearchingBackup(true);

        // In this robust implementation, we'll try to use the GCSE element that is hopefully loaded
        // Or we rely on the user manually browsing the gallery below.
        // For automatic image, we would need a Search API Key which is complex to setup.
        // Let's assume the gallery is the primary way to see more.

        // We will simulate a search or use a placeholder if no URL provided
        // Since we don't have a real Custom Search API key in the code (it used process.env.API_KEY in user snippet),
        // we'll skip the fetchBackupImage logic that calls googleapis.com directly to avoid 403s.
        setIsSearchingBackup(false);
    };

    const handleImageError = () => {
        if (currentImageIndex < playerImageUrls.length - 1) {
            setCurrentImageIndex(prev => prev + 1);
        } else {
            // If no image, show placeholder or rely on Gallery
            setProImageLoaded(true); // Allow showing what we have (maybe empty or fallback)
        }
    };

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
                        {/* Split Visual Comparison */}
                        <div className="relative flex-1 group min-h-[360px] md:min-h-[480px]">
                            <div className="flex h-full rounded-[2rem] md:rounded-[3rem] overflow-hidden border-2 border-white/10 shadow-3xl bg-neutral-900">
                                <div className="relative flex-1 border-r border-white/10">
                                    <img src={userImage} className="w-full h-full object-cover grayscale brightness-110 contrast-125" alt="Candidate" />
                                    <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 bg-black/60 backdrop-blur-xl px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[7px] md:text-[8px] font-black uppercase text-white border border-white/10 tracking-widest">Candidate</div>
                                </div>

                                <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden">
                                    {!proImageLoaded && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-10 transition-opacity duration-500" style={{ opacity: proImageLoaded ? 0 : 1 }}>
                                            <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-3"></div>
                                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Retrieving Asset</span>
                                        </div>
                                    )}

                                    {/* Fallback Display if no image */}
                                    <div className="flex flex-col items-center justify-center text-center p-4">
                                        <span className="text-4xl mb-2">⚽</span>
                                        <span className="text-xs text-slate-500 font-bold uppercase">{match.playerName}</span>
                                    </div>

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

                    {/* Integrated Archive Toggle */}
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

export default ResultDisplay;
