import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api/client';
import './Chatbot.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotProps {
  analysisId: number;
}

export default function Chatbot({ analysisId }: ChatbotProps) {
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');
    setError(null);
    setLoading(true);

    const newHistory = [...history, { role: 'user' as const, content: userMessage }];
    setHistory(newHistory);

    try {
      const response = await sendChatMessage(
        analysisId,
        userMessage,
        history,
        apiKey.trim() || undefined
      );
      
      setHistory([...newHistory, { role: 'assistant', content: response.reply }]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-container card">
      <h3 className="section-label">🤖 Analyst Chatbot</h3>
      <p className="chatbot-description">Ask questions about this specific email analysis.</p>
      
      <div className="chatbot-config">
        <label htmlFor="apiKey" className="chatbot-label">OpenRouter API Key (Optional)</label>
        <input
          id="apiKey"
          type="password"
          className="chatbot-input"
          placeholder="Leave blank to use system default..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <small className="chatbot-help">Enter your key to test if it works, or leave blank to use the backend's default.</small>
      </div>

      <div className="chatbot-messages">
        {history.length === 0 && !loading && (
          <div className="chatbot-empty">No messages yet. Start asking!</div>
        )}
        {history.map((msg, index) => (
          <div key={index} className={`chatbot-message ${msg.role}`}>
            <div className="chatbot-bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="chatbot-message assistant">
            <div className="chatbot-bubble loading">
               <span className="dot"></span><span className="dot"></span><span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {error && <div className="chatbot-error">{error}</div>}

      <form className="chatbot-form" onSubmit={handleSend}>
        <input
          type="text"
          className="chatbot-input"
          placeholder="Ask a question..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn btn--primary" disabled={loading || !message.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
