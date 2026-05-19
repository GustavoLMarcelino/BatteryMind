import React, { useState, useRef, useEffect } from 'react';
import logo from './assets/logo.png';

function App() {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      sender: 'bot', 
      text: 'Olá! Sou o BatteryMind, o assistente inteligente da Premium Baterias. 🧠⚡ Me conta: qual o modelo do seu carro e o que está acontecendo com a sua bateria?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const API_URL = 'http://localhost:5000/api/chat'; 

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    const userMsg = { id: Date.now(), sender: 'user', text: userText };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Chamada real para o Back-end
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) {
        throw new Error('Erro na resposta do servidor');
      }

      const data = await response.json();

      // Monta a resposta do robô baseada no retorno das 3 camadas de IA do Back-end
      const botReply = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.replyText, // Texto explicativo/resposta geral do bot
        type: data.recommendedProduct ? 'recommendation' : 'text', 
        metadata: {
          sentiment: data.sentiment,     // Retorno da Camada I (PLN)
          urgency: data.urgency,         // Retorno da Camada II (Fuzzy)
          optimization: data.optimization // Retorno da Camada III (Meta-heurística)
        },
        product: data.recommendedProduct // Objeto contendo { name, description, price }
      };

      setMessages(prev => [...prev, botReply]);
    } catch (error) {
      console.error("Erro ao conectar com a IA:", error);
      
      // Mensagem de erro caso o back-end esteja offline
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Desculpe, estou enfrentando dificuldades para me conectar ao módulo de inteligência agora. Por favor, verifique se o servidor backend está ativo.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      
      {/* Sidebar Lateral - Dashboard Premium Baterias */}
      <div className="hidden md:flex flex-col w-80 bg-zinc-900 text-white p-5 border-r border-zinc-800 justify-between">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-800">
            <img src={logo} alt="" />
          </div>
        </div>
      </div>

      {/* Janela Principal do Chat */}
      <div className="flex flex-col flex-1 h-full bg-zinc-950 from-zinc-900 to-zinc-950">
        
        {/* Cabeçalho do Chat */}
        <div className="bg-zinc-900 shadow-md px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
            <div>
              <span className="font-bold text-zinc-100 block text-sm sm:text-base tracking-wide">BatteryMind IA</span>
              <span className="text-xs text-zinc-400">Análise de Urgência & Alocação Automatizada</span>
            </div>
          </div>
        </div>

        {/* Feed de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex flex-col max-w-[85%] sm:max-w-xl space-y-2">
                
                {/* Balão de Texto */}
                <div className={`p-4 rounded-2xl shadow-lg text-sm leading-relaxed tracking-wide ${
                  msg.sender === 'user' 
                    ? 'bg-amber-400 text-zinc-950 font-semibold rounded-tr-none' 
                    : 'bg-zinc-900 text-zinc-100 rounded-tl-none border border-zinc-800'
                }`}>
                  <p>{msg.text}</p>
                </div>

                {/* Bloco de Recomendação da IA da Premium Baterias */}
                {msg.type === 'recommendation' && (
                  <div className="bg-zinc-900 border-2 border-amber-400/90 rounded-2xl p-5 shadow-2xl space-y-4 animate-fade-in text-zinc-100">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        ⚡ RECOMENDAÇÃO PREMIUM OPTIMIZED
                      </span>
                      <span className="text-sm font-black text-white px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded">
                        {msg.product.price}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-white tracking-wide">{msg.product.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{msg.product.description}</p>
                    </div>

                    {/* Dados exigidos no PDF */}
                    <div className="bg-zinc-950/80 rounded-xl p-3 text.tight text-[11px] text-zinc-400 space-y-2 border border-zinc-800">
                      <div className="flex justify-between"><span className="text-zinc-500 font-medium">🧠 Camada I (PLN - Naive Bayes):</span> <span className="text-zinc-300 font-semibold">{msg.metadata.sentiment}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500 font-medium">📊 Camada II (Lógica Fuzzy):</span> <span className="text-zinc-300 font-semibold">{msg.metadata.urgency}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500 font-medium">🎯 Camada III (Meta-heurística):</span> <span className="text-amber-400 font-semibold">{msg.metadata.optimization}</span></div>
                    </div>

                    <button 
                      onClick={() => alert('Direcionando para agendamento de socorrista / motoboy Express!')}
                      className="w-full bg-amber-400 hover:bg-amber-500 text-zinc-950 font-black py-3 px-4 rounded-xl text-xs transition-all tracking-widest uppercase shadow-md"
                    >
                      Solicitar Entrega / Instalação Agora
                    </button>
                  </div>
                )}

              </div>
            </div>
          ))}

          {/* Indicador de "Digitando..." */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Input Inferior */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva o problema do veículo ou o modelo de bateria buscado..."
              className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm text-zinc-100 placeholder-zinc-500 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-zinc-950 rounded-xl text-sm font-black shadow-md transition-all uppercase tracking-wider"
            >
              Enviar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;