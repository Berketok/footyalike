import React, { useRef, useEffect, useCallback } from 'react';

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
                // Flip horizontally for self-view natural feel
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

                {/* Advanced Scanner Overlay UI */}
                <div className="absolute inset-0 border border-white/5 pointer-events-none">
                    {/* Corners */}
                    <div className="absolute top-8 left-8 w-10 h-10 border-t-4 border-l-4 border-green-500/80 rounded-tl-xl"></div>
                    <div className="absolute top-8 right-8 w-10 h-10 border-t-4 border-r-4 border-green-500/80 rounded-tr-xl"></div>
                    <div className="absolute bottom-8 left-8 w-10 h-10 border-b-4 border-l-4 border-green-500/80 rounded-bl-xl"></div>
                    <div className="absolute bottom-8 right-8 w-10 h-10 border-b-4 border-r-4 border-green-500/80 rounded-br-xl"></div>

                    {/* Central Aiming Ring */}
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

                <div className="w-14 h-14 md:w-16 md:h-16"></div> {/* Spacer for balance */}
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default Camera;
