import Link from 'next/link';
import { useState } from 'react';

const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes pulse0 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes pulse1 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes pulse2 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes pulse3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.12); }
        }
        @keyframes pulse4 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
      {/* Navigation Header */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '16px 0',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo */}
          <Link href="/">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              gap: '12px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              <div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '24px',
                  color: '#1A365D',
                  lineHeight: 1
                }}>
                  Aidstack <span style={{ color: '#475569' }}>Disasters</span>
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '11px',
                  color: '#94A3B8',
                  letterSpacing: '0.5px',
                  marginTop: '2px'
                }}>
                  Intelligence for impact workers
                </div>
              </div>
            </div>
          </Link>

          {/* CTA Button */}
          <Link href="/app">
            <button style={{
              background: '#FF6B35',
              color: 'white',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '15px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(255, 107, 53, 0.25)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.25)';
            }}
            >
              Launch App →
            </button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, #1A365D 0%, #2D5A7B 100%)',
        padding: '60px 20px 80px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.05,
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '60px',
          alignItems: 'center'
        }}>
          <div style={{ textAlign: 'left' }}>
            {/* Trust Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 107, 53, 0.15)',
              border: '1px solid rgba(255, 107, 53, 0.3)',
              borderRadius: '20px',
              padding: '6px 14px',
              marginBottom: '24px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#10B981',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'pulse 2s ease-in-out infinite'
              }}></span>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '13px',
                fontWeight: 600,
                color: 'white'
              }}>
                Live GDACS & ACLED Integration
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '56px',
              lineHeight: '1.1',
              color: 'white',
              marginBottom: '24px',
              letterSpacing: '-0.02em'
            }}>
              Forward-Looking Intelligence
              <br />
              <span style={{
                background: 'linear-gradient(90deg, #FF6B35 0%, #FFA366 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                for Humanitarian Operations
              </span>
            </h1>
            <p style={{
              fontSize: '20px',
              lineHeight: '1.7',
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '32px',
              maxWidth: '540px'
            }}>
              Plan ahead with AI-powered scenario analysis and predictive forecasts. Monitor disasters, assess risks, and anticipate what's coming next—all in one platform.
            </p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '40px' }}>
              <Link href="/app">
                <button style={{
                  background: '#FF6B35',
                  color: 'white',
                  border: 'none',
                  padding: '16px 36px',
                  borderRadius: '10px',
                  fontSize: '17px',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 16px rgba(255, 107, 53, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 16px rgba(255, 107, 53, 0.4)';
                }}
                >
                  Start Free →
                </button>
              </Link>
              <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer">
                <button style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  padding: '16px 36px',
                  borderRadius: '10px',
                  fontSize: '17px',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                >
                  View on GitHub
                </button>
              </a>
            </div>

            {/* Quick stats/use cases */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              maxWidth: '500px'
            }}>
              {[
                { icon: '🎯', text: 'Campaign Planning' },
                { icon: '🚨', text: 'Emergency Response' },
                { icon: '🛡️', text: 'Safety & Security' },
                { icon: '📦', text: 'Logistics & Routes' }
              ].map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.95)',
                    fontFamily: "'Inter', sans-serif"
                  }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* App Preview - Right Side */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            transform: 'perspective(1000px) rotateY(-5deg)',
            transition: 'transform 0.3s ease'
          }}>
            {/* Browser Chrome */}
            <div style={{
              background: '#F3F4F6',
              borderRadius: '12px 12px 0 0',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #E5E7EB'
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FF6B35' }}></div>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFC107' }}></div>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10B981' }}></div>
              </div>
              <div style={{
                flex: 1,
                background: 'white',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#94A3B8',
                fontFamily: "'Inter', sans-serif"
              }}>
                disasters.aidstack.ai/app
              </div>
            </div>

            {/* App Interface Mockup */}
            <div style={{
              background: '#F8FAFC',
              borderRadius: '0 0 12px 12px',
              overflow: 'hidden',
              position: 'relative',
              minHeight: '500px'
            }}>
              {/* Top Header Bar */}
              <div style={{
                background: 'white',
                padding: '16px 20px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                  </svg>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '18px',
                    color: '#1A365D'
                  }}>aidstack.disasters</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{
                    background: '#F1F5F9',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#1A365D',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      background: '#10B981',
                      borderRadius: '50%',
                      display: 'inline-block'
                    }}></span>
                    23 Disasters
                  </div>
                  <div style={{
                    background: '#FF6B35',
                    color: 'white',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    Operational Outlook
                  </div>
                </div>
              </div>

              {/* Map Area with Disaster Markers */}
              <div style={{
                position: 'relative',
                height: '400px',
                background: 'linear-gradient(135deg, #E0F2FE 0%, #DBEAFE 50%, #E0E7FF 100%)',
                overflow: 'hidden'
              }}>
                {/* Simulated world map pattern */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.1,
                  backgroundImage: 'radial-gradient(circle at 2px 2px, #1A365D 1px, transparent 0)',
                  backgroundSize: '30px 30px'
                }}></div>

                {/* Disaster Markers */}
                {[
                  { top: '25%', left: '20%', color: '#EF4444', label: 'EQ 6.2M' },
                  { top: '40%', left: '65%', color: '#FF6B35', label: 'TC' },
                  { top: '60%', left: '35%', color: '#F59E0B', label: 'FL' },
                  { top: '30%', left: '80%', color: '#EF4444', label: 'VO' },
                  { top: '70%', left: '15%', color: '#10B981', label: 'DR' },
                ].map((marker, idx) => (
                  <div key={idx} style={{
                    position: 'absolute',
                    top: marker.top,
                    left: marker.left,
                    transform: 'translate(-50%, -50%)',
                    animation: `pulse${idx} 2s ease-in-out infinite`
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: marker.color,
                      opacity: 0.3,
                      position: 'absolute'
                    }}></div>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: marker.color,
                      border: '3px solid white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-28px',
                        background: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: marker.color,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        whiteSpace: 'nowrap'
                      }}>
                        {marker.label}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Facility Markers */}
                {[
                  { top: '28%', left: '22%', impacted: true },
                  { top: '42%', left: '66%', impacted: true },
                  { top: '55%', left: '50%', impacted: false },
                  { top: '65%', left: '70%', impacted: false },
                ].map((facility, idx) => (
                  <div key={idx} style={{
                    position: 'absolute',
                    top: facility.top,
                    left: facility.left,
                    transform: 'translate(-50%, -50%)'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={facility.impacted ? '#EF4444' : '#10B981'} stroke="white" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    </svg>
                  </div>
                ))}

                {/* Right Side Drawer Preview */}
                <div style={{
                  position: 'absolute',
                  right: '20px',
                  top: '20px',
                  width: '280px',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  overflow: 'hidden'
                }}>
                  {/* Drawer Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1A365D 0%, #2D5A7B 100%)',
                    padding: '16px',
                    color: 'white'
                  }}>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: '16px',
                      marginBottom: '8px'
                    }}>
                      Operational Outlook
                    </div>
                    <div style={{
                      fontSize: '12px',
                      opacity: 0.9,
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      Generating scenario analysis...
                    </div>
                  </div>

                  {/* Chat Preview */}
                  <div style={{ padding: '16px' }}>
                    <div style={{
                      background: '#F1F5F9',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '8px',
                      fontSize: '12px',
                      color: '#475569',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      What scenarios should we plan for?
                    </div>
                    <div style={{
                      background: '#FF6B35',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12px',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      Most likely: Moderate flooding in 3 districts. Escalation: 8+ districts affected...
                    </div>
                  </div>
                </div>

                {/* Bottom Stats Bar */}
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  right: '320px',
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  display: 'flex',
                  gap: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '4px', fontFamily: "'Inter', sans-serif" }}>TOTAL FACILITIES</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1A365D', fontFamily: "'Space Grotesk', sans-serif" }}>245</div>
                  </div>
                  <div style={{ width: '1px', background: '#E5E7EB' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '4px', fontFamily: "'Inter', sans-serif" }}>IMPACTED</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#EF4444', fontFamily: "'Space Grotesk', sans-serif" }}>34</div>
                  </div>
                  <div style={{ width: '1px', background: '#E5E7EB' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '4px', fontFamily: "'Inter', sans-serif" }}>SAFE</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#10B981', fontFamily: "'Space Grotesk', sans-serif" }}>211</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section style={{
        padding: '80px 20px',
        background: 'white'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '42px',
            textAlign: 'center',
            color: '#1A365D',
            marginBottom: '60px'
          }}>
            From Disaster Alert to Action Plan in Minutes
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '40px'
          }}>
            {/* Benefit 1 */}
            <div style={{
              background: '#F8FAFC',
              padding: '32px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: '#1A365D',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </div>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: '#0F172A',
                marginBottom: '12px'
              }}>
                Real-Time Awareness
              </h3>
              <ul style={{
                color: '#475569',
                fontSize: '16px',
                lineHeight: '1.8',
                paddingLeft: '20px'
              }}>
                <li>Live GDACS disaster data</li>
                <li>CAP XML polygon impact zones</li>
                <li>ACLED conflict event tracking</li>
                <li>Automatic updates every refresh</li>
              </ul>
            </div>

            {/* Benefit 2 */}
            <div style={{
              background: '#F8FAFC',
              padding: '32px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: '#1A365D',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: '#0F172A',
                marginBottom: '12px'
              }}>
                Instant Impact Assessment
              </h3>
              <ul style={{
                color: '#475569',
                fontSize: '16px',
                lineHeight: '1.8',
                paddingLeft: '20px'
              }}>
                <li>Upload facilities via CSV/Excel</li>
                <li>Shapefile support for district boundaries</li>
                <li>Automated distance calculations</li>
                <li>District-level risk mapping</li>
              </ul>
            </div>

            {/* Benefit 3 */}
            <div style={{
              background: '#F8FAFC',
              padding: '32px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: '#1A365D',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: '#0F172A',
                marginBottom: '12px'
              }}>
                AI-Powered Foresight
              </h3>
              <ul style={{
                color: '#475569',
                fontSize: '16px',
                lineHeight: '1.8',
                paddingLeft: '20px'
              }}>
                <li>Operational Outlook with 3 scenarios</li>
                <li>Disaster & outbreak forecasts</li>
                <li>Real-time web search for current events</li>
                <li>Early warning indicators to monitor</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section style={{
        padding: '80px 20px',
        background: '#F8FAFC'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '60px',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '36px',
                color: '#1A365D',
                marginBottom: '24px'
              }}>
                The Challenge
              </h2>
              <p style={{
                fontSize: '18px',
                lineHeight: '1.8',
                color: '#475569',
                marginBottom: '20px'
              }}>
                Humanitarian organizations struggle to quickly assess which of their facilities are at risk when disasters strike. Manual monitoring across multiple data sources wastes critical response time.
              </p>
            </div>
            <div>
              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '36px',
                color: '#1A365D',
                marginBottom: '24px'
              }}>
                The Solution
              </h2>
              <p style={{
                fontSize: '18px',
                lineHeight: '1.8',
                color: '#475569',
                marginBottom: '32px'
              }}>
                Aidstack Disasters consolidates global disaster data, automates impact assessment, and generates AI-powered response recommendations—all in one visual interface.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px'
              }}>
                <div style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #94A3B8'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#FF6B35',
                    marginBottom: '8px'
                  }}>100+</div>
                  <div style={{ fontSize: '14px', color: '#475569' }}>Disasters Monitored</div>
                </div>
                <div style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #94A3B8'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#FF6B35',
                    marginBottom: '8px'
                  }}>1,000+</div>
                  <div style={{ fontSize: '14px', color: '#475569' }}>Facilities Assessed</div>
                </div>
                <div style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid #94A3B8'
                }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#FF6B35',
                    marginBottom: '8px'
                  }}>&lt;30s</div>
                  <div style={{ fontSize: '14px', color: '#475569' }}>AI Analysis Time</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Use Cases Section */}
      <section style={{
        padding: '100px 20px',
        background: 'linear-gradient(180deg, #F8FAFC 0%, white 100%)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block',
              background: '#FF6B35',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '20px',
              fontFamily: "'Inter', sans-serif"
            }}>
              ONE PLATFORM, MULTIPLE OPERATIONS
            </div>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '48px',
              color: '#0F172A',
              marginBottom: '20px',
              letterSpacing: '-0.01em'
            }}>
              Purpose-Built for <span style={{ color: '#FF6B35' }}>Operational Excellence</span>
            </h2>
            <p style={{
              fontSize: '20px',
              color: '#475569',
              maxWidth: '700px',
              margin: '0 auto',
              lineHeight: '1.7'
            }}>
              From emergency response to strategic planning, get real-time intelligence for every critical decision
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '28px'
          }}>
            {[
              {
                title: 'Campaign Planning',
                emoji: '🎯',
                description: 'Plan immunization, WASH, nutrition, or shelter campaigns with forward-looking scenario analysis',
                features: ['Operational Outlook scenarios', 'District risk visualization', 'Go/No-Go recommendations', 'Predictive disaster forecasts']
              },
              {
                title: 'Emergency Response',
                emoji: '🚨',
                description: 'Rapid deployment decisions with AI-powered scenario planning—anticipate what comes next',
                features: ['Real-time disaster alerts', 'Escalation scenario planning', 'Early warning indicators', 'Web-sourced current events']
              },
              {
                title: 'Safety & Security',
                emoji: '🛡️',
                description: 'Monitor conflict zones and protect field teams with ACLED integration',
                features: ['Conflict event tracking', 'Security incident mapping', 'Event type filtering', 'Trend analysis']
              },
              {
                title: 'Logistics & Routes',
                emoji: '📦',
                description: 'Plan safe supply routes and avoid disaster/conflict zones',
                features: ['Route safety assessment', 'Multi-country operations', 'Shapefile boundary import', 'Coordinate system support']
              },
              {
                title: 'Strategic Planning',
                emoji: '📊',
                description: 'Forward-looking operational viability with scenario-based planning',
                features: ['District dashboard', 'Scenario-based planning', 'Outbreak predictions', 'Supply chain forecasts']
              }
            ].map((useCase, idx) => (
              <div key={idx} style={{
                background: 'white',
                border: '2px solid #E5E7EB',
                borderRadius: '16px',
                padding: '36px',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 107, 53, 0.15)';
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = '#FF6B35';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}
              >
                <div style={{
                  fontSize: '48px',
                  marginBottom: '20px',
                  lineHeight: 1
                }}>
                  {useCase.emoji}
                </div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '24px',
                  color: '#1A365D',
                  marginBottom: '12px'
                }}>
                  {useCase.title}
                </h3>
                <p style={{
                  color: '#64748B',
                  fontSize: '15px',
                  lineHeight: '1.7',
                  marginBottom: '20px'
                }}>
                  {useCase.description}
                </p>
                <ul style={{
                  color: '#475569',
                  fontSize: '14px',
                  lineHeight: '2',
                  paddingLeft: 0,
                  margin: 0,
                  listStyle: 'none'
                }}>
                  {useCase.features.map((item, i) => (
                    <li key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section style={{
        padding: '80px 20px',
        background: '#1A365D'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '42px',
            textAlign: 'center',
            color: 'white',
            marginBottom: '60px'
          }}>
            Intelligence for Every Stage of Response
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '32px'
          }}>
            {[
              {
                title: 'Humanitarian Organizations',
                description: 'Protect field staff by identifying high-risk areas before deployment'
              },
              {
                title: 'Emergency Response Teams',
                description: 'Prioritize which facilities need immediate assistance during multi-disaster events'
              },
              {
                title: 'Program Managers',
                description: 'Determine campaign feasibility by analyzing security and disaster risks'
              },
              {
                title: 'Logistics Coordinators',
                description: 'Optimize supply routes by avoiding disaster impact zones'
              }
            ].map((useCase, idx) => (
              <div key={idx} style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  width: '8px',
                  height: '40px',
                  background: '#FF6B35',
                  borderRadius: '4px',
                  marginBottom: '20px'
                }}></div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '22px',
                  color: 'white',
                  marginBottom: '12px'
                }}>
                  {useCase.title}
                </h3>
                <p style={{
                  color: '#94A3B8',
                  fontSize: '16px',
                  lineHeight: '1.7',
                  margin: 0
                }}>
                  {useCase.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{
        padding: '80px 20px',
        background: 'white'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '42px',
            textAlign: 'center',
            color: '#1A365D',
            marginBottom: '60px'
          }}>
            Five Steps to Forward-Looking Operations
          </h2>
          <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute',
              left: '23px',
              top: '30px',
              bottom: '30px',
              width: '2px',
              background: '#FF6B35'
            }}></div>

            {[
              {
                title: 'View Global Disasters',
                description: 'Access real-time data from GDACS showing earthquakes, floods, cyclones, volcanic activity, and more'
              },
              {
                title: 'Upload Your Facilities & Boundaries',
                description: 'Import facility locations from CSV/Excel and upload shapefiles for district/regional boundaries'
              },
              {
                title: 'Automatic Impact Assessment',
                description: 'System calculates which facilities fall within disaster impact radii and highlights affected districts'
              },
              {
                title: 'Get Operational Outlook',
                description: 'AI generates 3 scenarios (most likely, escalation, stabilization) with early warning indicators to monitor'
              },
              {
                title: 'View Predictive Forecasts',
                description: 'Access disaster forecasts, outbreak predictions, and supply chain disruption assessments'
              }
            ].map((step, idx) => (
              <div key={idx} style={{
                display: 'flex',
                gap: '24px',
                marginBottom: idx < 4 ? '40px' : '0',
                position: 'relative'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: '#1A365D',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '4px solid white',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '20px',
                    color: '#FF6B35'
                  }}>
                    {idx + 1}
                  </span>
                </div>
                <div style={{
                  background: '#F8FAFC',
                  padding: '24px',
                  borderRadius: '12px',
                  flex: 1
                }}>
                  <h3 style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '20px',
                    color: '#0F172A',
                    marginBottom: '8px'
                  }}>
                    {step.title}
                  </h3>
                  <p style={{
                    color: '#475569',
                    fontSize: '16px',
                    lineHeight: '1.7',
                    margin: 0
                  }}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section style={{
        padding: '80px 20px',
        background: '#F8FAFC'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '42px',
            textAlign: 'center',
            color: '#1A365D',
            marginBottom: '60px'
          }}>
            Trusted Global Data
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '40px'
          }}>
            {/* GDACS */}
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '26px',
                color: '#1A365D',
                marginBottom: '16px'
              }}>
                GDACS
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#94A3B8',
                marginBottom: '20px',
                fontStyle: 'italic'
              }}>
                Global Disaster Alert and Coordination System
              </p>
              <ul style={{
                color: '#475569',
                fontSize: '16px',
                lineHeight: '1.8',
                paddingLeft: '20px',
                margin: 0
              }}>
                <li>UN-backed disaster monitoring</li>
                <li>7 disaster types tracked</li>
                <li>Updated continuously</li>
                <li>CAP XML precision polygons</li>
              </ul>
            </div>

            {/* ACLED */}
            <div style={{
              background: 'white',
              padding: '40px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '26px',
                color: '#1A365D',
                marginBottom: '16px'
              }}>
                ACLED
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#94A3B8',
                marginBottom: '20px',
                fontStyle: 'italic'
              }}>
                Armed Conflict Location & Event Data Project
              </p>
              <ul style={{
                color: '#475569',
                fontSize: '16px',
                lineHeight: '1.8',
                paddingLeft: '20px',
                margin: 0
              }}>
                <li>Real-time conflict tracking</li>
                <li>50+ countries covered</li>
                <li>Daily updates</li>
                <li>Geo-coded precision</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section style={{
        padding: '80px 20px',
        background: 'white'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '42px',
            textAlign: 'center',
            color: '#1A365D',
            marginBottom: '60px'
          }}>
            Common Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              {
                question: 'What is the Operational Outlook feature?',
                answer: 'The Operational Outlook uses AI to generate forward-looking humanitarian analysis with 3 scenarios (most likely, escalation, stabilization), early warning indicators, and operational implications. It helps you anticipate what\'s coming next, not just what happened.'
              },
              {
                question: 'What predictive forecasts are available?',
                answer: 'The platform provides weather-based disaster forecasts (cyclones, floods), disease outbreak predictions, and supply chain disruption assessments. All forecasts integrate with the Operational Outlook for comprehensive scenario planning.'
              },
              {
                question: 'How does the AI use real-time web search?',
                answer: 'The AI assistant can search the web for current humanitarian events, recent outbreak data, and breaking news to supplement its analysis. This ensures recommendations are based on the most up-to-date information available.'
              },
              {
                question: 'Can I use my own facility data?',
                answer: 'Yes, upload any CSV or Excel file with name, latitude, and longitude columns. You can also upload shapefiles for district boundaries to get district-level risk assessments.'
              },
              {
                question: 'Is my data stored on servers?',
                answer: 'Facility data is cached locally in your browser only. No server-side storage. However, when using AI features, data is temporarily sent to OpenAI for analysis.'
              }
            ].map((faq, idx) => (
              <div key={idx} style={{
                background: '#F8FAFC',
                border: '1px solid #94A3B8',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    background: openFaq === idx ? '#1A365D' : 'transparent',
                    color: openFaq === idx ? 'white' : '#0F172A',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    fontSize: '18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {faq.question}
                  <span style={{ fontSize: '24px' }}>
                    {openFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {openFaq === idx && (
                  <div style={{
                    padding: '20px 24px',
                    color: '#475569',
                    fontSize: '16px',
                    lineHeight: '1.7',
                    background: 'white'
                  }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section style={{
        padding: '80px 20px',
        background: 'linear-gradient(180deg, white 0%, #F8FAFC 100%)',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '42px',
            color: '#1A365D',
            marginBottom: '16px'
          }}>
            Ready to Transform Your Disaster Response?
          </h2>
          <p style={{
            fontSize: '18px',
            color: '#475569',
            marginBottom: '40px'
          }}>
            Start monitoring global disasters and protecting your facilities today
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/app">
              <button style={{
                background: '#FF6B35',
                color: 'white',
                border: 'none',
                padding: '16px 40px',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                Get Started Now →
              </button>
            </Link>
            <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer">
              <button style={{
                background: 'transparent',
                color: '#1A365D',
                border: '2px solid #1A365D',
                padding: '16px 40px',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#1A365D';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#1A365D';
              }}
              >
                View on GitHub
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#1A365D',
        padding: '60px 20px 40px',
        color: 'white'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '40px',
            marginBottom: '40px'
          }}>
            {/* Branding */}
            <div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                marginBottom: '12px'
              }}>
                Aidstack <span style={{ color: '#FF6B35' }}>Disasters</span>
              </div>
              <p style={{
                color: '#94A3B8',
                fontSize: '14px',
                lineHeight: '1.6',
                margin: 0
              }}>
                Part of Aidstack.ai - Intelligence for impact workers
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                marginBottom: '16px'
              }}>
                Product
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="#features" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >Features</a>
                <a href="#use-cases" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >Use Cases</a>
                <a href="#how-it-works" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >How It Works</a>
              </div>
            </div>

            {/* Resources */}
            <div>
              <h4 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                marginBottom: '16px'
              }}>
                Resources
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="https://aidstack.ai" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >About Aidstack</a>
                <a href="https://github.com/jmesplana" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >GitHub</a>
                <a href="#" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >Documentation</a>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                marginBottom: '16px'
              }}>
                Legal
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="#" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >Privacy</a>
                <a href="#" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.3s' }}
                   onMouseEnter={(e) => e.target.style.color = 'white'}
                   onMouseLeave={(e) => e.target.style.color = '#94A3B8'}
                >Terms</a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            paddingTop: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <p style={{
              color: '#94A3B8',
              fontSize: '14px',
              margin: 0
            }}>
              © 2025 Aidstack.ai. All rights reserved.
            </p>
            <p style={{
              color: '#94A3B8',
              fontSize: '14px',
              margin: 0
            }}>
              Developed by <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer" style={{ color: '#FF6B35', textDecoration: 'none' }}>John Mark Esplana</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
