import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Mic, MicOff, Bot, User, Volume2, VolumeX, StopCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);

  // TTS State
  const [isAutoSpeak, setIsAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(new Audio());

  const { language, setLanguage, languages, t } = useLanguage();

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // API Configuration
  const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;

  const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
  const PERPLEXITY_MODEL = "sonar";

  // VOICE RSS API KEY
  const VOICE_RSS_KEY = import.meta.env.VITE_VOICE_RSS_KEY;

  // ============================================
  // 1. ROBUST VOICE RSS TTS FUNCTION
  // ============================================
  const speakText = (text, langCode) => {
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (!text) return;

    // Map App Language Codes to Voice RSS Codes
    // Voice RSS supports specific codes. For unsupported ones, we map to Hindi or closest.
    const voiceRSSMap = {
      'en-IN': 'en-in',
      'hi-IN': 'hi-in',
      'gu-IN': 'hi-in', // VoiceRSS might not have Gujarati specific, fallback to Hindi accent or English
      'ta-IN': 'ta-in',
      'te-IN': 'te-in', // Check VoiceRSS docs, sometimes 'hi-in' fallback needed
      'kn-IN': 'hi-in', // Fallback
      'mr-IN': 'hi-in', // Fallback
      'bn-IN': 'hi-in', // Fallback
      'pa-IN': 'hi-in'  // Fallback
    };

    // Note: Voice RSS Free tier has strict limits (350 req/day). 
    // If you hit limit, it stops working until next day.

    const targetLang = voiceRSSMap[langCode] || 'hi-in';
    const cleanText = text.replace(/[*#_]/g, ''); // Remove Markdown chars

    // Construct Voice RSS URL
    const url = `https://api.voicerss.org/?key=${VOICE_RSS_KEY}&hl=${targetLang}&v=Puja&c=MP3&f=16khz_16bit_stereo&src=${encodeURIComponent(cleanText)}`;

    try {
      audioRef.current.src = url;
      audioRef.current.playbackRate = 1.0;

      setIsSpeaking(true);

      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Audio started
          })
          .catch(error => {
            console.error("Audio Playback Failed:", error);
            setIsSpeaking(false);
          });
      }

      audioRef.current.onended = () => setIsSpeaking(false);
      audioRef.current.onerror = (e) => {
        console.error("Audio Error (Check API Quota):", e);
        setIsSpeaking(false);
      };

    } catch (e) {
      console.error("TTS Setup Error:", e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  };

  // Initial Greeting & Language Reset Logic
  useEffect(() => {
    const greetings = {
      'en-IN': 'Hello! I am Krishi Mitra. Ask me anything about farming! 🌾',
      'hi-IN': 'नमस्ते! मैं आपका कृषि मित्र हूं। मुझसे खेती के बारे में कुछ भी पूछें! 🌾',
      'gu-IN': 'નમસ્તે! હું તમારો કૃષિ મિત્ર છું. મને ખેતી વિશે કંઈ પણ પૂછો! 🌾',
      'ta-IN': 'வணக்கம்! நான் உங்கள் கிருஷி மித்ரா. விவசாயம் பற்றி எதையும் கேளுங்கள்! 🌾',
      'te-IN': 'నమస్కారం! నేను మీ కృషి మిత్ర. వ్యవసాయం గురించి నన్ను ఏమైనా అడగండి! 🌾',
      'kn-IN': 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಕೃಷಿ ಮಿತ್ರ. ಕೃಷಿಯ ಬಗ್ಗೆ ಏನೇ ಕೇಳಿ! 🌾',
      'mr-IN': 'नमस्कार! मी तुमचा कृषी मित्र आहे. मला शेतीबद्दल काहीही विचारा! 🌾',
      'bn-IN': 'নমস্কার! আমি আপনার কৃষি মিত্র। আমাকে চাষাবাদ সম্পর্কে যা খুশি জিজ্ঞাসা করুন! 🌾',
      'pa-IN': 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ ਕ੍ਰਿਸ਼ੀ ਮਿੱਤਰ ਹਾਂ। ਮੈਨੂੰ ਖੇਤੀ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ! 🌾'
    };

    const greetingText = greetings[language] || greetings['en-IN'];

    // Stop any ongoing speech when language changes (optional but good UX)
    stopSpeaking();

    // Reset messages to just the greeting when language changes
    setMessages([{ id: Date.now(), type: 'bot', text: greetingText, time: new Date() }]);

    if (isAutoSpeak && isOpen) {
      setTimeout(() => speakText(greetingText, language), 800);
    }
  }, [language]); // Depend on language to trigger reset

  // Initial Auto-Speak check when opening
  useEffect(() => {
    if (isAutoSpeak && isOpen && messages.length > 0) {
      // Speak the last bot message if just opened
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.type === 'bot') {
        speakText(lastMsg.text, language);
      }
    }
  }, [isOpen]);


  // Fetch Location & Weather
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          setLocation({ lat: 23.0225, lng: 72.5714 });
          fetchWeather(23.0225, 72.5714);
        }
      );
    }
  }, []);

  const fetchWeather = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${import.meta.env.VITE_WEATHER_API_KEY}`
      );
      const data = await res.json();
      setWeather({
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        humidity: data.main.humidity,
        city: data.name
      });
    } catch (e) {
      console.error('Weather fetch failed:', e);
    }
  };

  // Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results).map(result => result[0].transcript).join('');
        setInput(transcript);
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return alert('Voice input not supported');
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      stopSpeaking();
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    stopSpeaking();
    const userMessage = { id: Date.now(), type: 'user', text: input, time: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const langName = languages.find(l => l.code === language)?.name || 'Hindi';
    const systemPrompt = `You are Krishi Mitra AI. Respond in ${langName}. Context: ${weather?.city}, ${weather?.temp}°C. Keep it concise (under 50 words). Plain text only.`;

    try {
      const response = await fetch(PERPLEXITY_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: PERPLEXITY_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      const botResponse = data.choices?.[0]?.message?.content || 'Error getting response.';

      const botMessage = { id: Date.now() + 1, type: 'bot', text: botResponse, time: new Date() };
      setMessages(prev => [...prev, botMessage]);

      if (isAutoSpeak) {
        speakText(botResponse, language);
      }
    } catch (error) {
      console.error("API Error:", error);
      const errorMsg = 'Connection error. Please try again.';
      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'bot', text: errorMsg, time: new Date() }]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className={`chatbot-panel ${isOpen ? 'open' : ''}`}>
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <Bot size={24} />
            <div>
              <h3>{t('chatbot_title')}</h3>
              <span className="chatbot-status">
                {weather ? `${weather.city} • ${weather.temp}°C` : 'Online'}
              </span>
            </div>
          </div>
          <div className="chatbot-header-actions">
            <button
              onClick={() => {
                const newState = !isAutoSpeak;
                setIsAutoSpeak(newState);
                if (!newState) stopSpeaking();
              }}
              className="p-1 hover:bg-white/10 rounded-full transition-colors mr-1"
              title={isAutoSpeak ? "Mute Auto-Speak" : "Enable Auto-Speak"}
            >
              {isAutoSpeak ? <Volume2 size={18} color="white" /> : <VolumeX size={18} color="white" />}
            </button>
            <select
              className="chatbot-lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {languages.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
            <button
              className="chatbot-close"
              onClick={() => {
                setIsOpen(false);
                stopSpeaking(); // Stop speaking when closed
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="chatbot-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chatbot-message ${msg.type}`}>
              <div className="message-avatar">
                {msg.type === 'bot' ? <Bot size={18} /> : <User size={18} />}
              </div>
              <div className="message-content">
                <p>{msg.text}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="message-time">{formatTime(msg.time)}</span>
                  {msg.type === 'bot' && (
                    <button onClick={() => speakText(msg.text, language)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity" title="Read Aloud">
                      <Volume2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chatbot-message bot">
              <div className="message-avatar"><Bot size={18} /></div>
              <div className="message-content typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {isSpeaking && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
            <button onClick={stopSpeaking} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 text-xs transition-all animate-bounce">
              <StopCircle size={14} /> Stop Speaking
            </button>
          </div>
        )}

        <div className="chatbot-input-area">
          <button className={`chatbot-voice-btn ${isListening ? 'listening' : ''}`} onClick={toggleListening} title="Voice Input">
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('chat_placeholder')}
            disabled={isLoading}
          />
          <button className="chatbot-send-btn" onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>

      <button className={`chatbot-fab ${isOpen ? 'hidden' : ''}`} onClick={() => setIsOpen(true)}>
        <MessageSquare size={24} />
      </button>
    </>
  );
};

export default ChatBot;
