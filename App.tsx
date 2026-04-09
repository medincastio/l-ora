
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { GoogleGenAI, Modality } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Languages, ChevronDown, Check, Volume2, VolumeX, Copy, Share2, RotateCcw, Keyboard, Search, Sparkles } from 'lucide-react';
import LetterCard from './components/LetterCard';
import BackgroundParticles from './components/BackgroundParticles';
import CursorParticles from './components/CursorParticles';
import DrawingCanvas, { DrawingCanvasRef } from './components/DrawingCanvas';

const COLORS = [
  '#F43F5E', '#EC4899', '#D946EF', '#A855F7', '#8B5CF6',
  '#6366F1', '#3B82F6', '#0EA5E9', '#06B6D4', '#14B8A6',
  '#10B981', '#22C55E', '#EAB308', '#F59E0B', '#F97316',
];

const SYMBOLS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'],
  ['!', '"', "'", ':', ';', '/', '?', ',', '.']
];

const LANGUAGES = {
  EN: { name: "English", placeholder: "Type", rtl: false, layout: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M']] },
  FR: { name: "Français", placeholder: "Écrivez", rtl: false, layout: [['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'], ['W', 'X', 'C', 'V', 'B', 'N', 'É', 'À', 'È', 'Ç']] },
  AR: { name: "العربية", placeholder: "اكتب", rtl: true, layout: [['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'], ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط', 'ئ'], ['ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ']] },
  RU: { name: "Русский", placeholder: "Печатать", rtl: false, layout: [['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'], ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'], ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю']] },
  HI: { name: "हिन्दी", placeholder: "लिखें", rtl: false, layout: [['ौ', 'ै', 'ा', 'ी', 'ू', 'ब', 'ह', 'ग', 'द', 'ज', 'ड'], ['ो', 'े', '्', 'ि', 'ु', 'प', 'र', 'क', 'ت', 'च', 'ट'], ['अ', 'इ', 'अ', 'ए', 'ओ', 'ण', 'न', 'म', 'ل', 'स']] },
  ES: { name: "Español", placeholder: "Escribe", rtl: false, layout: [['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'], ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '¿', '¡']] },
  JP: { name: "日本語", placeholder: "入力", rtl: false, layout: [['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'], ['さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と'], ['な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ']] },
  HE: { name: "עברית", placeholder: "הקלד", rtl: true, layout: [['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'], ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'], ['ז', 'ס', 'ב', 'נ', 'מ', 'צ', 'ת', 'ץ']] }
};

interface DisplayChar {
  id: string;
  char: string;
  color: string;
}

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [displayChars, setDisplayChars] = useState<DisplayChar[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [currentLang, setCurrentLang] = useState<keyof typeof LANGUAGES>('EN');
  const [isSymbols, setIsSymbols] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isProcessingHandwriting, setIsProcessingHandwriting] = useState(false);
  const [wordInfo, setWordInfo] = useState<{
    translation: string;
    definition: string;
    sentence: string;
  } | null>(null);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const drawingCanvasRef = useRef<DrawingCanvasRef>(null);

  const playSound = (type: 'click' | 'pop' | 'woosh' | 'drop') => {
    const urls = {
      click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      pop: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      woosh: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
      drop: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'
    };
    const audio = new Audio(urls[type]);
    audio.volume = 0.15;
    audio.play().catch(() => {});
  };

  const handleTranslate = async (targetLangKey: string) => {
    const langKey = targetLangKey as keyof typeof LANGUAGES;
    setCurrentLang(langKey);
    setIsLangMenuOpen(false);
    playSound('click');

    if (!inputText.trim() || isTranslating) return;
    
    setIsTranslating(true);
    playSound('woosh');
    try {
      const targetLangName = LANGUAGES[langKey].name;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate this text to ${targetLangName}. Return ONLY the translated string, no explanations: "${inputText}"`,
      });
      setInputText(response.text.trim());
    } catch (e) {
      console.error("Translation failed", e);
    } finally {
      setIsTranslating(false);
    }
  };

  const createCards = useCallback((text: string) => {
    if (!text.trim()) return;
    playSound('woosh');
    setDisplayChars(text.split('').map((char, index) => ({
      id: `${Date.now()}-${index}-${char}`,
      char,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    })));
    setShowResults(true);
  }, []);

  const handleHandwritingRecognition = async (base64Image: string) => {
    setIsProcessingHandwriting(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          },
          {
            text: "Recognize the handwriting in this image. It could be a single letter or a short word. Return ONLY the recognized text, nothing else. If you're not sure, return your best guess.",
          },
        ],
      });
      
      const recognizedText = response.text.trim();
      if (recognizedText) {
        setInputText(recognizedText);
        setIsDrawingMode(false);
        playSound('pop');
        createCards(recognizedText);
      }
    } catch (error) {
      console.error("Handwriting recognition error:", error);
    } finally {
      setIsProcessingHandwriting(false);
    }
  };

  const handleHandwritingDetect = async (base64Image: string) => {
    setIsProcessingHandwriting(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          },
          {
            text: "Recognize the handwriting in this image. It is likely a single letter or a short word. Return ONLY the recognized text, nothing else. If it's a single letter, return it exactly. If you're not sure, return your best guess.",
          },
        ],
      });
      
      const recognizedText = response.text.trim();
      if (recognizedText) {
        setInputText(prev => {
          const newText = prev ? `${prev}${recognizedText}` : recognizedText;
          return newText.slice(0, 60);
        });
        playSound('pop');
      }
    } catch (error) {
      console.error("Handwriting detection error:", error);
    } finally {
      setIsProcessingHandwriting(false);
    }
  };

  const speakText = async (text: string, isSlow: boolean = false) => {
    if (!text) return;

    if (isSpeaking) {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) { /* ignore */ }
        audioSourceRef.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    playSound('click');

    const effectiveRate = isSlow ? 0.5 : 1.0;
    const voiceToUse = 'Kore';

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceToUse },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        const audioContext = audioContextRef.current;
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = effectiveRate;
        source.connect(audioContext.destination);
        
        source.onended = () => {
          setIsSpeaking(false);
          if (isSlow) setIsSlowMode(false);
        };
        
        audioSourceRef.current = source;
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Speech failed", error);
      setIsSpeaking(false);
    }
  };

  const handleSpeech = async () => {
    const textToSpeak = displayChars.map(d => d.char).join('');
    if (displayChars.length === 0) return;

    const shouldPlaySlow = textToSpeak === lastSpokenText && !isSlowMode;
    setIsSlowMode(shouldPlaySlow);
    setLastSpokenText(textToSpeak);
    
    await speakText(textToSpeak, shouldPlaySlow);
  };

  const handleCopy = () => {
    const text = displayChars.map(d => d.char).join('');
    navigator.clipboard.writeText(text);
    playSound('click');
    // Show a temporary "Copied" toast or feedback
  };

  const handleShare = async () => {
    const text = displayChars.map(d => d.char).join('');
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Magic Letter Cards',
          text: `Check out this translation: ${text}`,
          url: window.location.href
        });
      } catch (e) {
        console.error("Share failed", e);
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ 
        x: (e.clientX / window.innerWidth) * 2 - 1, 
        y: (e.clientY / window.innerHeight) * 2 - 1 
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreate = useCallback(async () => {
    let textToProcess = inputText;

    if (isDrawingMode && drawingCanvasRef.current?.hasContent) {
      const base64Image = drawingCanvasRef.current.getImage();
      if (base64Image) {
        setIsProcessingHandwriting(true);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Image,
                },
              },
              {
                text: "Recognize the handwriting in this image. It could be a single letter or a short word. Return ONLY the recognized text, nothing else. If you're not sure, return your best guess.",
              },
            ],
          });
          
          const recognizedText = response.text.trim();
          if (recognizedText) {
            textToProcess = recognizedText;
            setInputText(recognizedText);
            setIsDrawingMode(false);
          }
        } catch (error) {
          console.error("Handwriting recognition error:", error);
          return;
        } finally {
          setIsProcessingHandwriting(false);
        }
      }
    }

    createCards(textToProcess);
  }, [inputText, isDrawingMode, ai, createCards]);

  const isWorking = isTranslating || isSpeaking || isProcessingHandwriting;
  const activeLayout = useMemo(() => isSymbols ? SYMBOLS : LANGUAGES[currentLang].layout, [isSymbols, currentLang]);
  const isRTL = LANGUAGES[currentLang].rtl && !isSymbols;

  const handleCharChange = useCallback((id: string, direction: 'up' | 'down') => {
    const chars = activeLayout.flat();
    setDisplayChars(prev => prev.map(item => {
      if (item.id !== id) return item;
      const currentIndex = chars.indexOf(item.char.toUpperCase());
      if (currentIndex === -1) return item;
      
      let nextIndex;
      if (direction === 'up') {
        nextIndex = (currentIndex + 1) % chars.length;
      } else {
        nextIndex = (currentIndex - 1 + chars.length) % chars.length;
      }
      
      return { ...item, char: chars[nextIndex] };
    }));
    playSound('pop');
  }, [activeLayout]);

  useEffect(() => {
    if (!showResults || displayChars.length === 0) {
      setWordInfo(null);
      return;
    }

    const word = displayChars.map(d => d.char).join('');
    if (word.length < 2) {
      setWordInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analyze the word "${word}". If it's a valid word in any language, return a JSON object with:
          "valid": true,
          "translation": "English translation",
          "definition": "Short English definition (max 15 words)",
          "sentence": "Short example sentence in the original language".
          If it's not a clear word, return {"valid": false}. Word: "${word}"`,
          config: { responseMimeType: "application/json" }
        });
        
        const result = JSON.parse(response.text);
        if (result.valid) {
          setWordInfo({
            translation: result.translation,
            definition: result.definition,
            sentence: result.sentence
          });
        } else {
          setWordInfo(null);
        }
      } catch (e) {
        console.error("Word check failed", e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [displayChars, showResults, ai]);
  
  const getSpatialStyle = (intensity: number = 5) => ({
    transform: `rotateY(${mousePos.x * intensity}deg) rotateX(${mousePos.y * -intensity}deg) translateZ(${intensity * 2}px)`,
    transition: 'transform 0.4s cubic-bezier(0.2, 0, 0.2, 1)',
    transformStyle: 'preserve-3d' as const,
  });

  const activeCard = useMemo(() => displayChars.find(c => c.id === activeId), [activeId, displayChars]);

  // Refined Motif Marquee Generator
  const motifMarquee = useMemo(() => {
    const list = Object.values(LANGUAGES).map(l => l.placeholder);
    const motifString = list.map(word => `${word} ✦`).join('  ');
    // Triple it for a dense pattern feel
    const combined = `${motifString}  ${motifString}  ${motifString}`;
    return combined;
  }, []);

  if (showResults) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center p-8 transition-all duration-500 bg-slate-950 perspective-1000 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <BackgroundParticles />
        <CursorParticles />
        <div className={`fixed top-0 left-0 right-0 h-1 z-[120] transition-all duration-500 ${isSpeaking ? 'bg-cyan-500 shadow-[0_0_15px_#06b6d4] opacity-100' : 'opacity-0'}`}>
          <div className="h-full bg-white/30 animate-[ping_2s_infinite]" />
        </div>

        <div className="fixed top-8 left-8 z-[150] flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
          <button onClick={() => { playSound('woosh'); setShowResults(false); setInputText(''); }} className="glass-panel px-6 py-2 rounded-full text-white font-semibold hover:bg-white/20 transition-all border-none active:scale-95">← Back</button>
          
          <div className="flex items-center glass-panel p-2.5 rounded-full group/logo transition-all hover:bg-white/5">
            <div className="relative">
              <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain relative z-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <div className="absolute inset-0 bg-cyan-400/20 blur-md rounded-full animate-pulse group-hover/logo:bg-cyan-400/40 transition-colors" />
            </div>
          </div>
          
          <div className="relative ml-2">
            <button 
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} 
              className={`glass-panel flex items-center gap-2 px-6 py-2 rounded-full text-white font-semibold transition-all border-none active:scale-95 ${isLangMenuOpen ? 'bg-white/10' : 'hover:bg-white/20'}`}
            >
              <Languages className="w-4 h-4 text-cyan-400" />
              Translate
            </button>

            {isLangMenuOpen && (
              <div className="absolute top-full mt-4 left-0 glass-panel p-2 rounded-full z-[160] max-w-[85vw] shadow-2xl animate-bounce-in overflow-hidden">
                <div className="px-4 py-1.5 mb-0.5">
                  <p className="text-[8px] font-black uppercase text-white/20 tracking-[0.2em]">Target Language</p>
                </div>
                <div className="flex flex-row gap-1 overflow-x-auto pb-1 custom-scrollbar-h">
                  {Object.entries(LANGUAGES).map(([key, lang]) => (
                    <button 
                      key={key} 
                      onClick={async () => {
                        const word = displayChars.map(d => d.char).join('');
                        setIsTranslating(true);
                        setIsLangMenuOpen(false);
                        playSound('woosh');
                        try {
                          const response = await ai.models.generateContent({
                            model: 'gemini-3-flash-preview',
                            contents: `Translate this word/text to ${lang.name}. Return ONLY the translated string: "${word}"`,
                          });
                          const translated = response.text.trim();
                          setInputText(translated);
                          setDisplayChars(translated.split('').map((char, index) => ({
                            id: `${Date.now()}-${index}-${char}`,
                            char,
                            color: COLORS[Math.floor(Math.random() * COLORS.length)]
                          })));
                          setCurrentLang(key as any);
                        } catch (e) {
                          console.error("Translation failed", e);
                        } finally {
                          setIsTranslating(false);
                        }
                      }} 
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap active:scale-95 ${currentLang === key ? 'bg-white text-slate-900 shadow-xl' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}
                    >
                      {lang.name}
                      {currentLang === key && <Check className="w-2.5 h-2.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="relative flex gap-2">
            <button onClick={handleCopy} className="glass-panel p-2.5 rounded-full text-white/50 hover:text-white hover:bg-white/20 transition-all border-none flex items-center justify-center active:scale-95" title="Copy Text">
              <Copy className="w-5 h-5" />
            </button>

            {navigator.share && (
              <button onClick={handleShare} className="glass-panel p-2.5 rounded-full text-white/50 hover:text-white hover:bg-white/20 transition-all border-none flex items-center justify-center active:scale-95" title="Share">
                <Share2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full h-full flex flex-col items-center justify-center gap-8 animate-swim relative px-6" style={getSpatialStyle(8)}>
          {wordInfo && (
            <div className="w-full max-w-4xl flex flex-col gap-6 z-[150] animate-bounce-in">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black uppercase text-cyan-400/40 tracking-[0.3em]">Usage Context</p>
                    <button 
                      onClick={() => speakText(wordInfo.sentence)}
                      className={`p-1 rounded-full transition-all hover:bg-white/10 active:scale-90 ${isSpeaking ? 'text-cyan-400' : 'text-white/30 hover:text-white'}`}
                      title="Listen to usage"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-lg md:text-xl text-white/90 font-bold italic leading-tight max-w-md">
                    "{wordInfo.sentence}"
                  </p>
                </div>
                
                <div className="flex flex-col items-end gap-1 text-right">
                  <p className="text-[9px] font-black uppercase text-purple-400/40 tracking-[0.3em]">Translation</p>
                  <p className="text-2xl font-black text-white tracking-tighter">
                    {wordInfo.translation}
                  </p>
                  <p className="text-xs text-white/40 font-medium max-w-[200px] leading-snug">
                    {wordInfo.definition}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => { setActiveId(e.active.id as string); playSound('woosh'); }} onDragEnd={(e) => {
            const { active, over } = e;
            setActiveId(null);
            playSound('drop');
            if (over && active.id !== over.id) setDisplayChars(items => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id)));
          }}>
            <div className="flex items-center gap-6 md:gap-10">
              <SortableContext items={displayChars.map(d => d.id)} strategy={rectSortingStrategy}>
                <div className={`flex flex-wrap justify-center content-center gap-4 md:gap-6 preserve-3d max-h-full transition-all duration-700 ${isSpeaking ? 'scale-[1.02]' : ''}`}>
                  {displayChars.map((item, index) => (
                    <div key={item.id} className={`transition-all duration-500 ${isSpeaking ? 'drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' : ''}`}>
                      <LetterCard 
                        id={item.id} 
                        char={item.char} 
                        color={item.color} 
                        delay={index * 80} 
                        isNew={true} 
                        onCharChange={handleCharChange}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>

              <button 
                onClick={handleSpeech} 
                className={`glass-panel p-4 md:p-6 rounded-full text-white transition-all border-none flex items-center justify-center active:scale-95 relative overflow-hidden shadow-2xl group/speak ${isSpeaking ? 'bg-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'hover:bg-white/10'}`}
                title={isSpeaking ? "Stop" : isSlowMode ? "Play Slow" : "Listen"}
              >
                <div className="relative z-10">
                  {isSpeaking ? <VolumeX className="w-6 h-6 md:w-8 md:h-8" /> : <Volume2 className="w-6 h-6 md:w-8 md:h-8" />}
                </div>
                {isSlowMode && !isSpeaking && (
                  <div className="absolute top-2 right-2">
                    <RotateCcw className="w-3 h-3 text-cyan-400 animate-spin-slow" />
                  </div>
                )}
                {!isSpeaking && <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent opacity-0 group-hover/speak:opacity-100 transition-opacity" />}
              </button>
            </div>

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
              {activeId && activeCard ? (
                <div style={{ transform: 'scale(1.1) rotate(-2deg)', transformStyle: 'preserve-3d' }}>
                  <LetterCard 
                    id={activeCard.id} 
                    char={activeCard.char} 
                    color={activeCard.color} 
                    delay={0} 
                    isNew={false} 
                    onCharChange={handleCharChange}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center text-white overflow-hidden perspective-1000 relative" dir={isRTL ? 'rtl' : 'ltr'}>
      <BackgroundParticles />
      <div className={`fixed top-0 left-0 right-0 h-1 z-[120] transition-all duration-700 ease-in-out ${isWorking ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500 shadow-[0_0_20px_#8b5cf6]' : 'opacity-0 scale-x-0'}`}>
        <div className="absolute inset-0 bg-white/20 animate-[ping_1.5s_infinite]" />
      </div>

      <div className="fixed inset-0 pointer-events-none transition-opacity duration-1000" style={{ background: `radial-gradient(circle at ${50 + mousePos.x * 20}% ${50 + mousePos.y * 20}%, rgba(56, 189, 248, 0.08) 0%, transparent 50%)`, zIndex: -1 }} />
      
      <div className="fixed top-8 left-8 z-[150] flex flex-col gap-3" style={{ pointerEvents: 'auto' }}>
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsLangMenuOpen(!isLangMenuOpen); playSound('click'); }} 
            className={`glass-panel flex items-center gap-3 px-4 py-2.5 rounded-full transition-all border-none relative group w-fit cursor-pointer active:scale-95 ${isLangMenuOpen ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
          >
            <div className="relative">
              <Globe className={`w-4 h-4 text-cyan-400 transition-transform duration-500 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              <div className="absolute inset-0 bg-cyan-400/20 blur-sm rounded-full animate-pulse" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
              {LANGUAGES[currentLang].name}
            </span>
            <ChevronDown className={`w-3 h-3 text-white/30 transition-transform duration-300 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        
        {isLangMenuOpen && (
          <div className="glass-panel p-2 rounded-full flex flex-col gap-1 animate-bounce-in max-w-[85vw] shadow-2xl overflow-hidden">
            <div className="px-4 py-1.5 mb-0.5">
              <p className="text-[8px] font-black uppercase text-white/20 tracking-[0.2em]">Select Language</p>
            </div>
            <div className="flex flex-row gap-1 overflow-x-auto pb-1 custom-scrollbar-h">
              {Object.entries(LANGUAGES).map(([key, lang]) => (
                <button 
                  key={key} 
                  onClick={() => handleTranslate(key)} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap active:scale-95 ${currentLang === key ? 'bg-white text-slate-900 shadow-xl' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}
                >
                  <span className={`w-1 h-1 rounded-full ${currentLang === key ? 'bg-slate-900' : 'bg-white/10 group-hover:bg-cyan-400'}`} />
                  {lang.name}
                  {currentLang === key && <Check className="w-2.5 h-2.5" />}
                </button>
              ))}
              <div className="w-[1px] bg-white/5 mx-1 self-stretch" />
              <button 
                onClick={() => { setIsSymbols(!isSymbols); setIsLangMenuOpen(false); playSound('click'); }} 
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${isSymbols ? 'bg-white text-slate-900 shadow-xl' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}
              >
                <span className={`w-1 h-1 rounded-full ${isSymbols ? 'bg-slate-900' : 'bg-white/10'}`} />
                Symbols
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center justify-center h-full w-full max-w-4xl py-12 px-4 gap-4">
        <div className="flex flex-col items-center gap-4 animate-bounce-in">
          <img src="/logo.png" alt="Logo" className="w-32 h-32 md:w-48 md:h-48 object-contain drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>

        <div className="w-full max-w-4xl px-4 flex flex-col items-center gap-2 mb-4">
          <h1 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Create Label</h1>
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        <div className="w-full max-w-2xl animate-swim" style={getSpatialStyle(6)}>
          <div className="relative w-full px-4 py-8 text-center overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
            
            {/* Multilingual Motif Marquee Placeholder */}
            {!inputText && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 overflow-hidden px-10">
                <div className="w-full relative overflow-hidden h-20 flex items-center">
                   <div className="animate-marquee whitespace-nowrap text-xl md:text-2xl font-light uppercase tracking-[0.3em] text-white/40">
                     {motifMarquee}
                   </div>
                   {/* Decorative Motif Borders */}
                   <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                   <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                   {/* Gradient masks for smooth fade edges */}
                   <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#020617] to-transparent z-10" />
                   <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#020617] to-transparent z-10" />
                </div>
              </div>
            )}

            <textarea 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              className="w-full bg-transparent text-5xl md:text-7xl font-black outline-none resize-none min-h-[140px] h-auto text-center tracking-tighter leading-tight transition-all duration-500 hover:scale-[1.01] overflow-hidden relative z-20" 
              autoFocus 
            />
            
            <div className="mt-8 flex items-center justify-center gap-4 relative z-30">
              <button onClick={handleCreate} disabled={!inputText.trim() || isWorking} className="group relative px-16 py-4 bg-transparent text-white font-black rounded-full transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:pointer-events-none">
                <div className="absolute inset-0 bg-white/5 blur-md group-hover:bg-white/10 transition-colors rounded-full" />
                <div className="absolute inset-0 border border-white/10 rounded-full group-hover:border-white/30 transition-colors" />
                <span className="relative z-10 tracking-[0.6em] text-[12px] uppercase">Create</span>
              </button>

              <button 
                onClick={() => { 
                  setShowKeyboard(!showKeyboard); 
                  if (!showKeyboard) setIsDrawingMode(false);
                  playSound('woosh'); 
                }} 
                className={`glass-panel flex items-center p-4 rounded-full transition-all border-none relative group w-fit cursor-pointer active:scale-95 ${showKeyboard ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
                title={showKeyboard ? "Hide Keyboard" : "Show Keyboard"}
              >
                <Keyboard className={`w-5 h-5 ${showKeyboard ? 'text-cyan-400' : 'text-white/40'}`} />
              </button>

              <button 
                onClick={() => { 
                  setIsDrawingMode(!isDrawingMode); 
                  if (!isDrawingMode) setShowKeyboard(false);
                  playSound('woosh'); 
                }} 
                className={`glass-panel flex items-center p-4 rounded-full transition-all border-none relative group w-fit cursor-pointer active:scale-95 ${isDrawingMode ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
                title="Handwriting Mode"
              >
                <div className="relative">
                  <Languages className={`w-5 h-5 ${isDrawingMode ? 'text-cyan-400' : 'text-white/40'}`} />
                  {isDrawingMode && <div className="absolute inset-0 bg-cyan-400/20 blur-sm rounded-full animate-pulse" />}
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-4xl px-4 -mt-4 min-h-[300px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {showKeyboard ? (
              <motion.div 
                key="keyboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full space-y-4"
                style={getSpatialStyle(4)}
              >
                <div className="space-y-2 select-none" dir={isRTL ? 'rtl' : 'ltr'}>
                  {activeLayout.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center gap-1.5">
                      {row.map(key => (
                        <button key={key} onClick={() => { playSound('click'); if (inputText.length < 60) setInputText(p => p + key); }} className="flex-1 max-w-[56px] aspect-square flex items-center justify-center text-2xl md:text-3xl font-light text-white/60 hover:text-white hover:bg-white/10 active:scale-50 transition-all rounded-full">{key}</button>
                      ))}
                      {rowIndex === 2 && <button onClick={() => { playSound('click'); setInputText(p => p.slice(0, -1)); }} className="flex-1 max-w-[64px] flex items-center justify-center text-white/20 hover:text-rose-500/80 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414A2 2 0 0010.828 19h8.344a2 2 0 002-2V7a2 2 0 00-2-2h-8.344a2 2 0 00-1.414.586L3 12z" /></svg></button>}
                    </div>
                  ))}
                  <div className="flex justify-center items-center gap-12 pt-6">
                    <button onClick={() => setInputText('')} className="text-[10px] font-black uppercase text-white/10 hover:text-rose-500/50 transition-all tracking-widest">Clear</button>
                    <button onClick={() => setInputText(p => p + ' ')} className="w-1/3 max-w-sm h-1 bg-white/5 hover:bg-white/20 transition-all rounded-full" />
                  </div>
                </div>
              </motion.div>
            ) : isDrawingMode ? (
              <motion.div 
                key="drawing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl"
              >
                <DrawingCanvas 
                  ref={drawingCanvasRef}
                  onClose={() => setIsDrawingMode(false)} 
                  onDone={handleHandwritingRecognition}
                  onDetect={handleHandwritingDetect}
                  isProcessing={isProcessingHandwriting}
                  recognizedText={inputText}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default App;
