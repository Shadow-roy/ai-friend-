import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { ConnectionState } from '../types';
import { createAudioBlob, decodeBase64, pcmToAudioBuffer, AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT } from '../utils/audio-utils';
import Visualizer from './Visualizer';

interface VoiceCallProps {
  apiKey: string;
}

const VoiceCall: React.FC<VoiceCallProps> = ({ apiKey }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  
  // Audio Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputMediaStreamRef = useRef<MediaStream | null>(null);
  const videoMediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Video Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoIntervalRef = useRef<number | null>(null);
  
  // Session Ref
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (connectionState === ConnectionState.CONNECTED) {
        setDurationSec(0);
        interval = window.setInterval(() => {
            setDurationSec(prev => prev + 1);
        }, 1000);
    } else {
        setDurationSec(0);
    }
    return () => clearInterval(interval);
  }, [connectionState]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getGreeting = () => {
      const h = new Date().getHours();
      if (h >= 5 && h < 12) return "Good Morning";
      if (h >= 12 && h < 17) return "Good Afternoon";
      if (h >= 17 && h < 21) return "Good Evening";
      return "Hello"; 
  };

  const cleanupAudio = useCallback(() => {
    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    scheduledSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (inputMediaStreamRef.current) {
      inputMediaStreamRef.current.getTracks().forEach(track => track.stop());
      inputMediaStreamRef.current = null;
    }

    if (videoMediaStreamRef.current) {
        videoMediaStreamRef.current.getTracks().forEach(track => track.stop());
        videoMediaStreamRef.current = null;
    }

    if (videoIntervalRef.current) {
        window.clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    
    setIsVideoActive(false);
    setIsScreenSharing(false);
  }, []);

  const handleDisconnect = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
             if (session && typeof session.close === 'function') {
                 session.close();
             }
        }).catch(() => {});
        sessionPromiseRef.current = null;
    }
    
    cleanupAudio();
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [cleanupAudio]);

  const startVideoProcessing = () => {
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

      videoIntervalRef.current = window.setInterval(() => {
          if (!videoPreviewRef.current || !canvasRef.current || !isVideoActive) return;
          
          const video = videoPreviewRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) return;

          canvas.width = video.videoWidth * 0.5;
          canvas.height = video.videoHeight * 0.5;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

          if (sessionPromiseRef.current) {
              sessionPromiseRef.current.then(session => {
                  session.sendRealtimeInput({
                      media: {
                          mimeType: 'image/jpeg',
                          data: base64Data
                      }
                  });
              }).catch(() => {});
          }

      }, 1000); 
  };

  const toggleVideo = async () => {
      setErrorMsg(null);
      if (isVideoActive && !isScreenSharing) {
          if (videoMediaStreamRef.current) {
              videoMediaStreamRef.current.getTracks().forEach(t => t.stop());
              videoMediaStreamRef.current = null;
          }
          if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
          setIsVideoActive(false);
          if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      } else {
          try {
              if (videoMediaStreamRef.current) {
                   videoMediaStreamRef.current.getTracks().forEach(t => t.stop());
              }
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              videoMediaStreamRef.current = stream;
              if (videoPreviewRef.current) {
                  videoPreviewRef.current.srcObject = stream;
              }
              setIsVideoActive(true);
              setIsScreenSharing(false);
              startVideoProcessing();
          } catch(e: any) {
              console.error("Camera access failed", e);
              setErrorMsg("Camera failed: " + (e.message || "Permission denied"));
          }
      }
  };

  const toggleScreenShare = async () => {
      setErrorMsg(null);
      if (isScreenSharing) {
          if (videoMediaStreamRef.current) {
            videoMediaStreamRef.current.getTracks().forEach(t => t.stop());
            videoMediaStreamRef.current = null;
          }
          if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
          setIsScreenSharing(false);
          setIsVideoActive(false);
          if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      } else {
          try {
              if (videoMediaStreamRef.current) {
                videoMediaStreamRef.current.getTracks().forEach(t => t.stop());
              }
              const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              videoMediaStreamRef.current = stream;
              if (videoPreviewRef.current) {
                  videoPreviewRef.current.srcObject = stream;
              }
              
              stream.getVideoTracks()[0].onended = () => {
                  setIsScreenSharing(false);
                  setIsVideoActive(false);
              };

              setIsScreenSharing(true);
              setIsVideoActive(true);
              startVideoProcessing();
          } catch(e: any) {
              console.error("Screen share failed", e);
              setErrorMsg("Screen share failed: " + (e.message || "Permission denied"));
              setIsScreenSharing(false);
          }
      }
  };

  const startCall = async () => {
    setErrorMsg(null);
    setConnectionState(ConnectionState.CONNECTING);

    try {
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const inputCtx = new InputContextClass({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });
      const outputCtx = new InputContextClass({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputMediaStreamRef.current = stream;

      const client = new GoogleGenAI({ apiKey });

      const greetingContext = `The current time is ${new Date().toLocaleTimeString()}. You MUST start the conversation immediately by greeting the user with "${getGreeting()}!". Do not wait for the user to speak first.`;

      const sessionPromise = client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createAudioBlob(inputData);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(err => {
                 console.error("Send Error:", err);
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             const interrupted = msg.serverContent?.interrupted;
             if (interrupted) {
                 scheduledSourcesRef.current.forEach(s => {
                     try { s.stop(); } catch(e) {}
                 });
                 scheduledSourcesRef.current.clear();
                 if (outputCtx) {
                    nextStartTimeRef.current = outputCtx.currentTime;
                 }
                 return; 
             }

             const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
                 if (!outputContextRef.current) return;
                 const ctx = outputContextRef.current;
                 
                 const pcmData = decodeBase64(base64Audio);
                 const audioBuffer = await pcmToAudioBuffer(pcmData, ctx);
                 
                 const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(ctx.destination);
                 
                 source.onended = () => {
                     scheduledSourcesRef.current.delete(source);
                 };
                 
                 source.start(startTime);
                 scheduledSourcesRef.current.add(source);
                 
                 nextStartTimeRef.current = startTime + audioBuffer.duration;
             }
          },
          onclose: () => {
             handleDisconnect();
          },
          onerror: (e) => {
             console.error("Live API Error", e);
             setErrorMsg("Connection error. Check API Key or Network.");
             handleDisconnect();
          }
        },
        config: {
          responseModalities: ['AUDIO'] as any,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: `You are a friendly, compassionate, and casual AI friend designed and trained by Sagar. ${greetingContext} If asked who created you, say Sagar. Keep responses concise.`
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to start call");
      cleanupAudio();
      setConnectionState(ConnectionState.DISCONNECTED);
    }
  };

  useEffect(() => {
     if (inputMediaStreamRef.current) {
         inputMediaStreamRef.current.getAudioTracks().forEach(track => {
             track.enabled = !isMuted;
         });
     }
  }, [isMuted]);

  useEffect(() => {
    return () => {
        handleDisconnect();
    };
  }, [handleDisconnect]);

  const isConnected = connectionState === ConnectionState.CONNECTED;

  return (
    <div className="w-full max-w-[360px] mx-auto h-[620px] relative">
      
      {/* Call Card Container */}
      <div className="w-full h-full bg-[#050505] rounded-[2.5rem] overflow-hidden flex flex-col relative shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/5">
          
          {/* Header Area */}
          <div className="flex flex-col items-center pt-8 pb-4 z-10 relative">
              <span className="text-[10px] font-mono text-slate-500 mb-2">01</span>
              <div className="bg-transparent border border-white px-6 py-2 rounded-full mb-6">
                 <span className="text-sm font-semibold text-white tracking-wide">AI Voice Assistant</span>
              </div>
              
              {/* Speech Bubble */}
              {isConnected && (
                <div className="absolute top-[88px] right-[40px] transform translate-x-1/2 bg-white text-black px-4 py-2 rounded-2xl rounded-bl-none shadow-lg animate-fade-in-up origin-bottom-left">
                    <span className="text-sm font-bold text-pink-500">Hello!</span>
                </div>
              )}
          </div>

          {/* Main Visualizer / Video Area */}
          <div className="flex-1 relative flex items-center justify-center w-full">
               <div className="relative w-full aspect-square max-w-[300px] flex items-center justify-center">
                   {/* Video Layer */}
                   <video 
                      ref={videoPreviewRef}
                      autoPlay 
                      playsInline 
                      muted 
                      className={`absolute inset-0 w-full h-full object-cover rounded-full transition-all duration-700 shadow-2xl z-20 border border-white/10 ${isVideoActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                   />
                   <canvas ref={canvasRef} className="hidden" />

                   {/* Visualizer Layer (Only show if video is off) */}
                   <div className={`absolute inset-0 transition-opacity duration-700 z-10 ${isVideoActive && !isScreenSharing ? 'opacity-0' : 'opacity-100'}`}>
                      <Visualizer isActive={isConnected} />
                   </div>
               </div>
          </div>

          {/* Status Text */}
          <div className="text-center z-10 mb-4">
               {isConnected ? (
                   <div className="flex flex-col items-center">
                       <span className="text-xl font-bold text-white tracking-tight">Gemini Friend</span>
                       <span className="text-xs text-green-400 font-mono mt-1">{formatDuration(durationSec)} • Connected</span>
                   </div>
               ) : (
                    <span className="text-slate-500 text-sm">Tap to Start</span>
               )}
          </div>

          {/* Controls Bar */}
          <div className="px-6 pb-8 z-20">
             {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
                <div className="flex justify-center">
                   <button
                    onClick={startCall}
                    className="group relative w-full py-4 bg-white text-black rounded-full font-bold shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>Start Call</span>
                  </button>
                </div>
             ) : (
               <div className="bg-[#1a1a1a] rounded-[2rem] p-2 flex items-center justify-between shadow-lg border border-white/5">
                  {/* Mute - Microphone Icon */}
                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isMuted ? 'bg-white text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  >
                     {isMuted ? (
                         // Muted Mic Icon
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <line x1="1" y1="1" x2="23" y2="23"></line>
                             <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                             <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                             <line x1="12" y1="19" x2="12" y2="23"></line>
                             <line x1="8" y1="23" x2="16" y2="23"></line>
                         </svg>
                     ) : (
                         // Active Mic Icon
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                         </svg>
                     )}
                  </button>
                  
                  {/* Camera */}
                  <button 
                    onClick={toggleVideo}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoActive && !isScreenSharing ? 'bg-white text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                  </button>

                  {/* Screen Share */}
                  <button 
                    onClick={toggleScreenShare}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-white text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" /></svg>
                  </button>

                  {/* Hang Up */}
                  <button 
                    onClick={handleDisconnect}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" transform="rotate(135 10 10)" /></svg>
                  </button>
               </div>
             )}
          </div>

          {errorMsg && (
            <div className="absolute top-24 left-6 right-6 p-3 bg-red-500/90 text-white text-xs rounded-xl backdrop-blur-md animate-fade-in text-center border border-red-400/50">
              {errorMsg}
            </div>
          )}
      </div>
    </div>
  );
};

export default VoiceCall;