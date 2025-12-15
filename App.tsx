import React, { useState } from 'react';
import VoiceCall from './components/VoiceCall';
import TextChat from './components/TextChat';
import { AppMode } from './types';

function App() {
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.VOICE_CALL);
  const apiKey = process.env.API_KEY || '';

  if (!apiKey) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white p-4">
              <div className="glass-panel p-8 rounded-2xl text-center max-w-md w-full border border-red-500/30">
                  <h1 className="text-xl font-bold mb-2 text-red-400">Missing API Key</h1>
                  <p className="text-slate-300">Please provide the <code>API_KEY</code> environment variable.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col items-center relative overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 -z-10 bg-[#020617]">
         <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[10000ms]"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] mix-blend-screen"></div>
         <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-indigo-900/10 rounded-full blur-[100px] mix-blend-screen"></div>
      </div>

      {/* Navbar */}
      <nav className="w-full max-w-6xl mx-auto p-6 flex flex-col md:flex-row justify-between items-center z-50">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
             <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 blur opacity-50 rounded-xl"></div>
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center border border-white/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </div>
             </div>
             <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-white">Gemini Friend</span>
                <span className="text-[10px] text-indigo-300 font-medium tracking-wider uppercase">Trained by Sagar</span>
             </div>
          </div>

          <div className="glass-panel p-1 rounded-full flex relative">
               <button 
                  onClick={() => setActiveMode(AppMode.VOICE_CALL)}
                  className={`relative z-10 px-6 py-2 rounded-full text-sm font-medium transition-all duration-500 ${activeMode === AppMode.VOICE_CALL ? 'text-white' : 'text-slate-400 hover:text-white'}`}
               >
                  Voice Call
               </button>
               <button 
                  onClick={() => setActiveMode(AppMode.TEXT_CHAT)}
                  className={`relative z-10 px-6 py-2 rounded-full text-sm font-medium transition-all duration-500 ${activeMode === AppMode.TEXT_CHAT ? 'text-white' : 'text-slate-400 hover:text-white'}`}
               >
                  Live Chat
               </button>
               
               {/* Sliding Pill */}
               <div 
                 className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-full border border-white/10 backdrop-blur-md shadow-lg transition-all duration-500 ease-in-out ${activeMode === AppMode.VOICE_CALL ? 'left-1' : 'left-[calc(50%+0px)]'}`}
               ></div>
          </div>
      </nav>

      {/* Main Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 flex flex-col justify-center items-center relative z-10 min-h-[600px]">
         {activeMode === AppMode.VOICE_CALL ? (
            <div className="w-full max-w-lg animate-fade-in perspective-1000">
               <VoiceCall apiKey={apiKey} />
            </div>
         ) : (
            <div className="w-full max-w-4xl h-[70vh] animate-fade-in">
               <TextChat apiKey={apiKey} />
            </div>
         )}
      </main>

      <footer className="py-6 text-center text-slate-500 text-sm z-10">
         <p>Powered by <a href="#" className="text-violet-400 hover:text-violet-300 transition-colors">Gemini Live</a></p>
      </footer>

    </div>
  );
}

export default App;