import React, { useEffect, useState, useRef } from 'react';
import { getSafetyAnalysis, getSafetyChatResponse } from '../services/geminiService';
import { EarthquakeFeature } from '../types';
import { ShieldCheck, Bot, CheckSquare, Square, Volume2, Octagon, BriefcaseMedical, VolumeX, AlertTriangle, MessageCircle, Send, User } from 'lucide-react';

interface SafetyTipsProps {
  recentQuakes: EarthquakeFeature[];
}

const KIT_ITEMS = [
  { id: 'water', label: 'পানি (জনপ্রতি ৩-৪ লিটার)' },
  { id: 'food', label: 'শুকনো খাবার (চিঁড়া, বিস্কুট, বাদাম)' },
  { id: 'firstaid', label: 'ফার্স্ট এইড বক্স ও জরুরি ঔষধ' },
  { id: 'torch', label: 'টর্চলাইট ও অতিরিক্ত ব্যাটারি' },
  { id: 'whistle', label: 'বাঁশি (উদ্ধারকারীদের জন্য)' },
  { id: 'docs', label: 'জরুরি কাগজপত্র (পলিথিনে মোড়ানো)' },
  { id: 'cash', label: 'নগদ টাকা' },
  { id: 'powerbank', label: 'পাওয়ার ব্যাংক ও চার্জার' },
  { id: 'mask', label: 'মাস্ক ও স্যানিটাইজার' },
];

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: number;
}

const SafetyTips: React.FC<SafetyTipsProps> = ({ recentQuakes }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Checklist State
  const [checkedItems, setCheckedItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('emergencyKit');
    return saved ? JSON.parse(saved) : [];
  });

  // SOS State
  const [isSirenActive, setIsSirenActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  // Fix: Use ReturnType<typeof setInterval> to handle both Node (NodeJS.Timeout) and Browser (number) types
  const sirenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('emergencyKit', JSON.stringify(checkedItems));
  }, [checkedItems]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchAnalysis = async () => {
      if (recentQuakes.length > 0) {
        const result = await getSafetyAnalysis(recentQuakes);
        if (isMounted) {
          setAnalysis(result);
          setLoading(false);
        }
      } else {
        if (isMounted) setLoading(false);
      }
    };

    fetchAnalysis();

    return () => { isMounted = false; };
  }, [recentQuakes]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => stopSiren();
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const toggleItem = (id: string) => {
    setCheckedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startSiren = () => {
    if (isSirenActive) return;
    setIsSirenActive(true);

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sawtooth';
      gain.gain.value = 1.0; // Max volume
      
      osc.start();
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;

      // Modulate frequency to create a siren sound
      let isHigh = false;
      sirenIntervalRef.current = setInterval(() => {
        if (!osc || !ctx) return;
        const now = ctx.currentTime;
        if (isHigh) {
          osc.frequency.linearRampToValueAtTime(600, now + 0.3); // Low pitch
        } else {
          osc.frequency.linearRampToValueAtTime(1500, now + 0.3); // High pitch
        }
        isHigh = !isHigh;
      }, 400);

    } catch (e) {
      console.error("Audio API not supported", e);
    }
  };

  const stopSiren = () => {
    setIsSirenActive(false);
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
    }
    audioCtxRef.current = null;
    oscillatorRef.current = null;
    gainNodeRef.current = null;
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: chatInput,
      sender: 'user',
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await getSafetyChatResponse(userMsg.text);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const progress = Math.round((checkedItems.length / KIT_ITEMS.length) * 100);

  return (
    <div className="pb-28 pt-4 px-4 max-w-2xl mx-auto">
      
      {/* SOS SIREN OVERLAY */}
      {isSirenActive && (
        <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center animate-pulse bg-red-600">
           <AlertTriangle size={100} className="text-white mb-6 animate-bounce" />
           <h1 className="text-4xl font-black text-white mb-8 text-center uppercase tracking-widest">জরুরি সাইরেন</h1>
           <button 
             onClick={stopSiren}
             className="bg-white text-red-600 px-10 py-6 rounded-full font-bold text-2xl shadow-xl hover:scale-105 transition-transform flex items-center"
           >
             <VolumeX size={32} className="mr-3"/> বন্ধ করুন
           </button>
           <p className="text-white mt-8 text-sm opacity-80">উদ্ধারকারীদের দৃষ্টি আকর্ষণ করতে এটি ব্যবহার করুন</p>
        </div>
      )}

      {/* SOS TOOL */}
      <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-6 flex flex-col items-center text-center shadow-sm">
        <h3 className="font-bold text-red-700 text-lg mb-2 flex items-center">
           <Octagon className="mr-2" /> ইমার্জেন্সি এসওএস (SOS)
        </h3>
        <p className="text-xs text-red-600 mb-4 px-4">
          বিপদে পড়লে বা ধ্বংসস্তূপের নিচে আটকা পড়লে এই বাটনটি চাপুন। এটি উচ্চ শব্দে সাইরেন বাজাবে এবং স্ক্রিন ফ্ল্যাশ করবে।
        </p>
        <button
          onClick={startSiren}
          className="bg-gradient-to-r from-red-600 to-rose-600 text-white w-20 h-20 rounded-full shadow-lg shadow-red-500/30 flex items-center justify-center active:scale-95 transition-all border-4 border-red-100"
        >
          <Volume2 size={32} />
        </button>
        <span className="text-xs font-bold text-red-500 mt-2">চাপ দিন</span>
      </div>

      {/* EMERGENCY KIT */}
      <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-slate-200">
         <div className="flex items-center justify-between mb-4">
           <h3 className="font-bold text-slate-800 text-lg flex items-center">
             <BriefcaseMedical className="mr-2 text-indigo-600" />
             জরুরি কিট ব্যাগ
           </h3>
           <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
             {progress}% প্রস্তুত
           </span>
         </div>
         
         <div className="w-full bg-slate-100 h-2 rounded-full mb-4 overflow-hidden">
           <div 
             className="bg-indigo-600 h-full transition-all duration-500" 
             style={{ width: `${progress}%` }}
           ></div>
         </div>

         <div className="grid grid-cols-1 gap-2">
           {KIT_ITEMS.map(item => (
             <button
               key={item.id}
               onClick={() => toggleItem(item.id)}
               className={`flex items-center p-3 rounded-xl border text-left transition-all ${
                 checkedItems.includes(item.id)
                   ? 'bg-green-50 border-green-200 text-green-800'
                   : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
               }`}
             >
               {checkedItems.includes(item.id) 
                 ? <CheckSquare className="mr-3 flex-shrink-0 text-green-600" size={20} /> 
                 : <Square className="mr-3 flex-shrink-0 text-slate-300" size={20} />
               }
               <span className="text-sm">
                 {item.label}
               </span>
             </button>
           ))}
         </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg mb-6">
        <div className="flex items-center mb-4">
          <Bot className="mr-3 w-8 h-8 text-blue-400" />
          <h2 className="text-xl font-bold">AI ভূমিকম্প বিশ্লেষণ</h2>
        </div>
        
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-2 bg-white/20 rounded"></div>
            <div className="h-2 bg-white/20 rounded w-5/6"></div>
            <div className="h-2 bg-white/20 rounded w-4/6"></div>
          </div>
        ) : (
          <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-light text-sm">
            {analysis}
          </div>
        )}
      </div>

      {/* AI Chatbot */}
      <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-slate-200">
         <div className="flex items-center mb-4">
           <MessageCircle className="mr-2 text-teal-600" />
           <h3 className="font-bold text-slate-800 text-lg">AI সুরক্ষা সহকারী</h3>
         </div>

         <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 h-64 overflow-y-auto mb-4 flex flex-col space-y-3">
            {chatMessages.length === 0 ? (
               <div className="text-center text-slate-400 text-sm mt-10">
                 আপনার মনে কোনো প্রশ্ন থাকলে করুন। <br/> যেমন: "১০ তলায় থাকলে কী করব?"
               </div>
            ) : (
              chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                    msg.sender === 'user' 
                      ? 'bg-teal-600 text-white rounded-br-none' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                  }`}>
                    {msg.sender === 'bot' && <div className="flex items-center text-xs font-bold text-teal-600 mb-1"><Bot size={12} className="mr-1"/> সহকারী</div>}
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex justify-start">
                 <div className="bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm text-xs text-slate-500 animate-pulse">
                   উত্তর লিখছে...
                 </div>
              </div>
            )}
            <div ref={chatEndRef} />
         </div>

         <div className="flex gap-2">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="প্রশ্ন করুন..."
              className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button 
              onClick={handleSendMessage}
              disabled={isChatLoading || !chatInput.trim()}
              className="bg-teal-600 text-white p-2 rounded-full hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
         </div>
      </div>

      {/* General Tips */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 text-lg flex items-center">
          <ShieldCheck className="mr-2 text-green-600" />
          সাধারণ সতর্কতা
        </h3>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-semibold text-rose-600 mb-1">কম্পনের সময়</h4>
          <p className="text-slate-600 text-sm">
            টেবিলের নিচে আশ্রয় নিন। মাথা ও ঘাড় হাত দিয়ে ঢেকে রাখুন। জানালা থেকে দূরে থাকুন।
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-semibold text-amber-600 mb-1">কম্পনের পরে</h4>
          <p className="text-slate-600 text-sm">
            গ্যাস লিক চেক করুন। লিফট ব্যবহার করবেন না। আফটারশকের জন্য প্রস্তুত থাকুন।
          </p>
        </div>
        
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-semibold text-blue-600 mb-1">জরুরি যোগাযোগ</h4>
          <p className="text-slate-600 text-sm">
             ফায়ার সার্ভিস ও সিভিল ডিফেন্স: <strong>৯৯৯</strong> অথবা <strong>০২-৯৫৫৫৫৫৫</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SafetyTips;