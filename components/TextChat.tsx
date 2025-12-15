import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage, MessageRole } from '../types';
import { decodeBase64, pcmToAudioBuffer } from '../utils/audio-utils';

interface TextChatProps {
  apiKey: string;
}

const TextChat: React.FC<TextChatProps> = ({ apiKey }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: MessageRole.MODEL,
      text: "Hi there! I'm here to chat, answer complex questions, or search the web for you. What's on your mind?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'fast' | 'think' | 'search'>('fast');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      let modelName = 'gemini-2.5-flash-lite-latest'; // Default "Fast"
      let config: any = {};
      let tools: any[] | undefined = undefined;

      if (mode === 'think') {
        modelName = 'gemini-3-pro-preview';
        config = {
          thinkingConfig: { thinkingBudget: 16000 },
        };
      } else if (mode === 'search') {
        modelName = 'gemini-2.5-flash';
        tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userMsg.text,
        config: {
          ...config,
          tools,
          systemInstruction: "You are a helpful assistant designed and trained by Sagar. If asked who created you, say Sagar. Always respond in English.",
        }
      });

      const text = response.text || "I couldn't generate a response.";
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let groundingText = '';
      if (groundingChunks) {
         const urls = groundingChunks
            .map((chunk: any) => chunk.web?.uri)
            .filter((uri: string) => !!uri);
         if (urls.length > 0) {
             groundingText = `\n\nSources:\n${urls.map((u: string) => `- ${u}`).join('\n')}`;
         }
      }

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        text: text + groundingText,
        timestamp: new Date(),
        isThinking: mode === 'think'
      };

      setMessages(prev => [...prev, modelMsg]);

    } catch (error: any) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.SYSTEM,
        text: `Error: ${error.message || "Something went wrong."}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTTS = async (text: string) => {
    try {
       const ai = new GoogleGenAI({ apiKey });
       const response = await ai.models.generateContent({
           model: 'gemini-2.5-flash-preview-tts',
           contents: { parts: [{ text }] },
           config: {
               responseModalities: ['AUDIO'] as any,
               speechConfig: {
                   voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
               }
           }
       });

       const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
       if (base64Audio) {
           const pcmData = decodeBase64(base64Audio);
           const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
           const audioBuffer = await pcmToAudioBuffer(pcmData, ctx, 24000);
           
           const source = ctx.createBufferSource();
           source.buffer = audioBuffer;
           source.connect(ctx.destination);
           source.start();
           
           source.onended = () => {
             ctx.close();
           };
       }
    } catch(e) {
        console.error("TTS Error", e);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full w-full mx-auto glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative bg-[#0a0a0e]/60 backdrop-blur-xl">
       
       {/* Header */}
       <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/5 z-20 backdrop-blur-md">
          <div className="flex items-center gap-4">
              <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 p-0.5">
                      <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden">
                         <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Gemini&backgroundColor=transparent" alt="Bot" className="w-full h-full object-cover" />
                      </div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full animate-pulse"></div>
              </div>
              <div>
                  <h3 className="text-white font-semibold text-sm tracking-wide">Gemini Friend</h3>
                  <p className="text-xs text-indigo-300 font-medium">
                      {isLoading ? 'Typing...' : 'Online'}
                  </p>
              </div>
          </div>

          {/* Mode Selector Pill */}
          <div className="flex bg-black/30 rounded-full p-1 border border-white/5">
              {(['fast', 'search', 'think'] as const).map((m) => (
                  <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                          mode === m 
                          ? 'bg-white text-black shadow-lg scale-105' 
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                      {m === 'fast' ? '⚡ Fast' : m === 'search' ? '🔍 Web' : '🧠 Deep'}
                  </button>
              ))}
          </div>
       </div>

       {/* Messages Area */}
       <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth custom-scrollbar">
          {messages.map((msg, index) => {
             const isUser = msg.role === MessageRole.USER;
             const isSystem = msg.role === MessageRole.SYSTEM;
             
             return (
                 <div 
                   key={msg.id} 
                   className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                   style={{ animationDelay: `${index * 50}ms` }}
                 >
                     <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
                         
                         {/* Name Label (Optional) */}
                         {!isUser && !isSystem && (
                             <span className="text-[10px] text-slate-400 mb-1 ml-2">Gemini</span>
                         )}

                         <div className={`relative px-5 py-3 shadow-lg backdrop-blur-sm transition-all hover:scale-[1.01] ${
                             isUser 
                             ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm border border-white/10' 
                             : isSystem
                             ? 'bg-red-500/10 text-red-200 border border-red-500/20 rounded-xl w-full text-center'
                             : 'bg-slate-800/60 text-slate-100 rounded-2xl rounded-tl-sm border border-white/5'
                         }`}>
                             {msg.isThinking && (
                                <div className="text-[10px] uppercase tracking-wider text-violet-300 mb-2 font-bold flex items-center gap-1 opacity-80">
                                   <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
                                   Deep Thinking
                                </div>
                             )}
                             
                             <p className="whitespace-pre-wrap text-sm leading-relaxed font-light">{msg.text}</p>
                             
                             <div className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end opacity-70' : 'justify-between'}`}>
                                 {!isUser && !isSystem && (
                                     <button 
                                       onClick={() => handleTTS(msg.text)}
                                       className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                                       title="Read Aloud"
                                     >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        </svg>
                                     </button>
                                 )}
                                 <span className="text-[10px] opacity-60">{formatTime(msg.timestamp)}</span>
                             </div>
                         </div>
                     </div>
                 </div>
             );
          })}
          
          {isLoading && (
              <div className="flex justify-start w-full animate-pulse">
                  <div className="bg-slate-800/50 rounded-2xl rounded-tl-sm p-4 border border-white/5 flex gap-1.5 items-center ml-0">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
                  </div>
              </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
       </div>

       {/* Input Area */}
       <div className="p-4 bg-black/40 border-t border-white/5 backdrop-blur-xl z-20">
           <form 
             onSubmit={(e) => { e.preventDefault(); handleSend(); }}
             className="relative flex items-center gap-2 max-w-4xl mx-auto"
           >
               <div className="relative flex-1 group">
                   <input 
                     type="text" 
                     value={inputValue}
                     onChange={(e) => setInputValue(e.target.value)}
                     placeholder={mode === 'search' ? "Ask me to search something..." : "Type a message..."}
                     className="w-full bg-white/5 border border-white/10 rounded-full pl-6 pr-12 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-sm shadow-inner"
                   />
                   <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"></div>
               </div>
               
               <button 
                 type="submit" 
                 disabled={!inputValue.trim() || isLoading}
                 className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white disabled:opacity-50 disabled:scale-90 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-white/10"
               >
                   {isLoading ? (
                       <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                   ) : (
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                       </svg>
                   )}
               </button>
           </form>
       </div>
    </div>
  );
};

export default TextChat;