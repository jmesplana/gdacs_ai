import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const ChatDrawer = ({
  isOpen,
  onClose,
  context
}) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your humanitarian aid advisor. I can help you understand how disasters might impact your programs and operations. Ask me anything about the current situation, health campaigns, or disaster response planning.',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleCopy = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingMessage('');

    try {
      // Debug: Log context to see what's being sent
      console.log('Chat context being sent:', {
        facilities: context.facilities?.length,
        disasters: context.disasters?.length,
        acledData: context.acledData?.length,
        acledEnabled: context.acledEnabled
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: context,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          stream: true
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedContent += parsed.content;
                setStreamingMessage(accumulatedContent);
              }
            } catch (e) {
              console.error('Failed to parse chunk:', data, e);
            }
          }
        }
      }

      const assistantMessage = {
        role: 'assistant',
        content: accumulatedContent,
        timestamp: Date.now(),
        isAIGenerated: true
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: Date.now(),
        isError: true
      }]);
      setStreamingMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "How will the current disasters affect ongoing health campaigns?",
    "Which facilities should we prioritize for immunization programs?",
    "What are the supply chain risks for malaria prevention?",
    "How should we adjust our program timeline?"
  ];

  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div
        className={`drawer drawer-right ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          zIndex: 3000,
          width: '420px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div className="drawer-header" style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          margin: '-20px -20px 0 -20px',
          padding: '20px',
          flexShrink: 0
        }}>
          <h3 className="drawer-title" style={{color: 'white', fontFamily: "'Space Grotesk', sans-serif"}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            AI Assistant
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: 0
        }}>
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              <div style={{
                backgroundColor: message.role === 'user'
                  ? 'var(--aidstack-navy)'
                  : message.isError
                  ? '#ffebee'
                  : 'var(--aidstack-light-gray)',
                color: message.role === 'user' ? 'white' : 'var(--aidstack-slate-dark)',
                padding: '10px 14px',
                borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: '13px',
                lineHeight: '1.5',
                fontFamily: "'Inter', sans-serif",
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                position: 'relative'
              }}>
                {message.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(message.content, index)}
                    title={copiedIndex === index ? "Copied!" : "Copy response"}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      opacity: 0.6,
                      transition: 'opacity 0.2s, background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.6';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {copiedIndex === index ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                )}
                {message.role === 'user' ? (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {message.content}
                  </div>
                ) : (
                  <div style={{ paddingRight: '24px' }}>
                    <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p style={{margin: '0.5em 0'}} {...props} />,
                      strong: ({node, ...props}) => <strong style={{fontWeight: 600}} {...props} />,
                      em: ({node, ...props}) => <em {...props} />,
                      ul: ({node, ordered, ...props}) => <ul style={{marginLeft: '1.2em', marginTop: '0.5em', marginBottom: '0.5em'}} {...props} />,
                      ol: ({node, ordered, ...props}) => <ol style={{marginLeft: '1.2em', marginTop: '0.5em', marginBottom: '0.5em'}} {...props} />,
                      li: ({node, ordered, ...props}) => <li style={{marginBottom: '0.3em'}} {...props} />,
                      code: ({node, inline, ...props}) => (
                        inline ?
                          <code style={{backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em'}} {...props} /> :
                          <code style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px', fontSize: '0.9em', overflow: 'auto'}} {...props} />
                      )
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--aidstack-slate-light)',
                marginTop: '4px',
                textAlign: message.role === 'user' ? 'right' : 'left',
                fontFamily: "'Inter', sans-serif"
              }}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}

          {streamingMessage && (
            <div style={{
              alignSelf: 'flex-start',
              maxWidth: '85%'
            }}>
              <div style={{
                backgroundColor: 'var(--aidstack-light-gray)',
                color: 'var(--aidstack-slate-dark)',
                padding: '10px 14px',
                borderRadius: '16px 16px 16px 4px',
                fontSize: '13px',
                lineHeight: '1.5',
                fontFamily: "'Inter', sans-serif",
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                <ReactMarkdown
                  components={{
                    p: ({node, ...props}) => <p style={{margin: '0.5em 0'}} {...props} />,
                    strong: ({node, ...props}) => <strong style={{fontWeight: 600}} {...props} />,
                    em: ({node, ...props}) => <em {...props} />,
                    ul: ({node, ordered, ...props}) => <ul style={{marginLeft: '1.2em', marginTop: '0.5em', marginBottom: '0.5em'}} {...props} />,
                    ol: ({node, ordered, ...props}) => <ol style={{marginLeft: '1.2em', marginTop: '0.5em', marginBottom: '0.5em'}} {...props} />,
                    li: ({node, ordered, ...props}) => <li style={{marginBottom: '0.3em'}} {...props} />,
                    code: ({node, inline, ...props}) => (
                      inline ?
                        <code style={{backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em'}} {...props} /> :
                        <code style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px', fontSize: '0.9em', overflow: 'auto'}} {...props} />
                    )
                  }}
                >
                  {streamingMessage}
                </ReactMarkdown>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '14px',
                  backgroundColor: 'var(--aidstack-slate-dark)',
                  marginLeft: '2px',
                  animation: 'blink 1s infinite'
                }}></span>
              </div>
            </div>
          )}

          {loading && !streamingMessage && (
            <div style={{
              alignSelf: 'flex-start',
              maxWidth: '85%'
            }}>
              <div style={{
                backgroundColor: 'var(--aidstack-light-gray)',
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                display: 'flex',
                gap: '6px',
                alignItems: 'center'
              }}>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {messages.length === 1 && (
            <div style={{
              marginTop: '10px'
            }}>
              <p style={{
                fontSize: '13px',
                color: 'var(--aidstack-slate-medium)',
                marginBottom: '10px',
                fontFamily: "'Inter', sans-serif"
              }}>
                Suggested questions:
              </p>
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInput(question)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    marginBottom: '8px',
                    backgroundColor: 'white',
                    border: '1px solid var(--aidstack-slate-light)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--aidstack-slate-dark)',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = 'var(--aidstack-light-gray)';
                    e.target.style.borderColor = 'var(--aidstack-navy)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.borderColor = 'var(--aidstack-slate-light)';
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end'
          }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about impacts on your programs..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1.5px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '13px',
                fontFamily: "'Inter', sans-serif",
                resize: 'none',
                minHeight: '40px',
                maxHeight: '100px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              rows={1}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--aidstack-navy)'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              title={loading ? "Sending..." : "Send message"}
              style={{
                width: '40px',
                height: '40px',
                padding: '0',
                backgroundColor: input.trim() && !loading ? 'var(--aidstack-orange)' : '#e5e7eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {loading ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
          </div>
        </div>

        <style jsx>{`
          .typing-indicator span {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--aidstack-slate-medium);
            animation: typing 1.4s infinite;
          }
          .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
          }
          .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
          }
          @keyframes typing {
            0%, 60%, 100% {
              transform: translateY(0);
              opacity: 0.7;
            }
            30% {
              transform: translateY(-10px);
              opacity: 1;
            }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes blink {
            0%, 49% {
              opacity: 1;
            }
            50%, 100% {
              opacity: 0;
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default ChatDrawer;
