import React, { useEffect, useRef, useState } from 'react';
import logo from './assets/logo.png';

const API_URL = '/api/recomendar';

const veiculosConhecidos = [
  'Gol 1.0',
  'Onix 1.0',
  'HB20 1.0',
  'Corolla 2.0',
  'Hilux',
  'Virtus',
  'Polo',
  'Saveiro',
  'Voyage',
  'Fox',
  'Ka',
  'Fiesta',
  'Ecosport',
  'Strada',
  'Toro',
  'S10',
  'Ranger',
  'Amarok',
  'Civic',
  'Uno',
  'Palio',
  'Celta',
  'Caminhão 24V'
];

function detectarVeiculo(texto) {
  const textoNormalizado = texto.toLowerCase();
  return veiculosConhecidos.find((veiculo) => textoNormalizado.includes(veiculo.toLowerCase())) || '';
}

function detectarOrcamento(texto) {
  const match = texto.match(/(?:ate|até|r\$|rs|orçamento|orcamento|valor|preço|preco)\s*(?:de|em|até|ate)?\s*(\d{2,5})(?:\s*reais)?/i);
  return match ? Number(match[1]) : 0;
}

function detectarUrgencia(texto) {
  const textoNormalizado = texto.toLowerCase();

  if (['urgente', 'hoje', 'agora', 'não liga', 'nao liga', 'parado', 'socorro'].some((termo) => textoNormalizado.includes(termo))) {
    return 'alta';
  }

  if (['problema', 'fraca', 'descarregou', 'ruim'].some((termo) => textoNormalizado.includes(termo))) {
    return 'media';
  }

  return 'baixa';
}

function detectarPreferencia(texto) {
  const textoNormalizado = texto.toLowerCase();

  if (['barato', 'economia', 'econômico', 'economico'].some((termo) => textoNormalizado.includes(termo))) {
    return 'economia';
  }

  if (['melhor', 'premium', 'qualidade', 'boa'].some((termo) => textoNormalizado.includes(termo))) {
    return 'qualidade';
  }

  return 'custo-beneficio';
}

function montarPayloadRecomendacao(mensagem, conversationId) {
  return {
    conversationId,
    nomeCliente: 'Cliente',
    mensagem,
    veiculo: detectarVeiculo(mensagem),
    orcamentoMaximo: detectarOrcamento(mensagem),
    preferencia: detectarPreferencia(mensagem),
    urgenciaInformada: detectarUrgencia(mensagem)
  };
}

function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Olá! Sou o BatteryMind, o assistente inteligente da Premium Baterias. Me conta: qual o modelo do seu carro e o que está acontecendo com a sua bateria?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const conversationIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    const userMsg = { id: Date.now(), sender: 'user', text: userText };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(montarPayloadRecomendacao(userText, conversationIdRef.current))
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Erro na resposta do servidor');
      }

      if (data.type === 'SOCIAL_RESPONSE') {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: data.message
          }
        ]);
        return;
      }

      if (data.success === false) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: data.message || data.data?.suggestedQuestion || 'Não consegui recomendar uma bateria ainda. Informe o veículo e descreva o problema.'
          }
        ]);
        return;
      }

      const resultado = data.data;
      const produto = resultado?.recomendacao?.produto;
      const servicos = resultado?.recomendacao?.servicos || [];

      if (!produto) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: 'Não consegui recomendar uma bateria ainda. Informe o veículo e descreva o problema.'
          }
        ]);
        return;
      }

      const botReply = {
        id: Date.now() + 1,
        sender: 'bot',
        text: resultado.recomendacao.justificativa,
        type: 'recommendation',
        metadata: {
          sentiment: `${resultado.analiseSentimento.sentimento} (${resultado.analiseSentimento.confianca}%)`,
          urgency: `${resultado.analiseFuzzy.prioridade} (${resultado.analiseFuzzy.scoreFuzzy}/100)`,
          optimization: `Fitness ${resultado.recomendacao.fitness}`,
          confidence: `${resultado.inputConfidence}/100`,
          confidenceLabel: resultado.recomendacao.confidenceLabel || 'recomendação'
        },
        product: {
          name: produto.nome,
          description: `${produto.marca} ${produto.modelo} para ${resultado.entrada.veiculo}. Serviços: ${servicos.length ? servicos.join(', ') : 'orientação de compra'}.`,
          price: produto.precoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        }
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (error) {
      console.error('Erro ao conectar com a IA:', error);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Desculpe, estou enfrentando dificuldades para me conectar ao módulo de inteligência agora. Por favor, verifique se o servidor backend está ativo.'
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      <div className="hidden md:flex flex-col w-80 bg-zinc-900 text-white p-5 border-r border-zinc-800 justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-800">
            <img src={logo} alt="Premium Baterias" />
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 h-full bg-zinc-950 from-zinc-900 to-zinc-950">
        <div className="bg-zinc-900 shadow-md px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
            <div>
              <span className="font-bold text-zinc-100 block text-sm sm:text-base tracking-wide">BatteryMind IA</span>
              <span className="text-xs text-zinc-400">Análise de Urgência & Alocação Automatizada</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex flex-col max-w-[85%] sm:max-w-xl space-y-2">
                <div
                  className={`p-4 rounded-2xl shadow-lg text-sm leading-relaxed tracking-wide ${
                    msg.sender === 'user'
                      ? 'bg-amber-400 text-zinc-950 font-semibold rounded-tr-none'
                      : 'bg-zinc-900 text-zinc-100 rounded-tl-none border border-zinc-800'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>

                {msg.type === 'recommendation' && (
                  <div className="bg-zinc-900 border-2 border-amber-400/90 rounded-2xl p-5 shadow-2xl space-y-4 animate-fade-in text-zinc-100">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        {msg.metadata.confidenceLabel}
                      </span>
                      <span className="text-sm font-black text-white px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded">
                        {msg.product.price}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-white tracking-wide">{msg.product.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{msg.product.description}</p>
                    </div>

                    <div className="bg-zinc-950/80 rounded-xl p-3 text-[11px] text-zinc-400 space-y-2 border border-zinc-800">
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500 font-medium">Entrada:</span>
                        <span className="text-zinc-300 font-semibold">{msg.metadata.confidence}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500 font-medium">Camada I (PLN - Naive Bayes):</span>
                        <span className="text-zinc-300 font-semibold">{msg.metadata.sentiment}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500 font-medium">Camada II (Lógica Fuzzy):</span>
                        <span className="text-zinc-300 font-semibold">{msg.metadata.urgency}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500 font-medium">Camada III (Meta-heurística):</span>
                        <span className="text-amber-400 font-semibold">{msg.metadata.optimization}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => alert('Direcionando para agendamento de entrega e instalação express!')}
                      className="w-full bg-amber-400 hover:bg-amber-500 text-zinc-950 font-black py-3 px-4 rounded-xl text-xs transition-all tracking-widest uppercase shadow-md"
                    >
                      Solicitar Entrega / Instalação Agora
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

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

        <div className="p-4 bg-zinc-900 border-t border-zinc-800">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Descreva o problema do veículo ou o modelo de bateria buscado..."
              className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm text-zinc-100 placeholder-zinc-500 transition-all"
              onKeyDown={(event) => event.key === 'Enter' && handleSend()}
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
