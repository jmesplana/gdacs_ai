import Link from 'next/link';
import { useState } from 'react';

const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const experimentalBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '10px',
    padding: '4px 8px',
    borderRadius: '999px',
    background: '#FEF3C7',
    color: '#92400E',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    verticalAlign: 'middle'
  };

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

        @media (max-width: 1024px) {
          .landing-header-inner {
            gap: 16px;
          }

          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }

          .hero-title {
            font-size: 44px !important;
          }

          .hero-preview {
            transform: none !important;
          }
        }

        @media (max-width: 768px) {
          .landing-header-inner {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-section {
            padding: 40px 16px 56px !important;
          }

          .hero-title {
            font-size: 34px !important;
          }

          .hero-copy {
            text-align: left;
          }

          .hero-stats {
            grid-template-columns: 1fr !important;
            max-width: none !important;
          }

          .hero-preview {
            padding: 14px !important;
          }
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
        <div className="landing-header-inner" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo */}
          <Link href="/landing">
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
      <section className="hero-section" style={{
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

        <div className="hero-grid" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '60px',
          alignItems: 'center'
        }}>
          <div className="hero-copy" style={{ textAlign: 'left' }}>
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

            <h1 className="hero-title" style={{
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
              Plan ahead with AI-powered scenario analysis, weather forecasts, and temporal playback. Monitor disasters, assess risks, and anticipate what's coming next—all in one platform.
            </p>
            <div style={{
              display: 'inline-flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
              marginBottom: '24px',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '12px',
              color: 'rgba(255, 255, 255, 0.92)',
              fontSize: '13px',
              lineHeight: '1.5',
              maxWidth: '560px'
            }}>
              <span style={{
                padding: '3px 8px',
                borderRadius: '999px',
                background: '#FEF3C7',
                color: '#92400E',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Experimental
              </span>
              <span>Forward-looking AI forecasts and early-warning features are still being validated and should be used as planning support, not as sole decision authority.</span>
            </div>
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
                  Launch App →
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
            <div className="hero-stats" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              maxWidth: '600px'
            }}>
              {[
                { number: '14-Day', label: 'Risk Forecasting' },
                { number: '1000+', label: 'Batch Assessments' },
                { number: '<30s', label: 'AI Analysis' }
              ].map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '16px 12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <span style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#FF6B35',
                    fontFamily: "'Space Grotesk', sans-serif"
                  }}>
                    {item.number}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.95)',
                    fontFamily: "'Inter', sans-serif",
                    textAlign: 'center'
                  }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* App Preview - Right Side */}
          <div className="hero-preview" style={{
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
              minHeight: '600px'
            }}>
              {/* Top Header Bar */}
              <div style={{
                background: 'white',
                padding: '12px 16px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                  </svg>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#1A365D'
                  }}>Aidstack</span>
                </div>

                <div style={{
                  flex: 1,
                  maxWidth: '200px',
                  background: '#F8FAFC',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: '#64748B',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  Select operation type
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      background: '#DC2626',
                      borderRadius: '50%',
                      display: 'inline-block'
                    }}></span>
                    23 Active
                  </div>
                  <div style={{
                    background: '#FF6B35',
                    color: 'white',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    fontSize: '10px',
                    fontWeight: 600
                  }}>
                    Analyze
                  </div>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Map Area with Disaster Markers */}
              <div style={{
                position: 'relative',
                height: '530px',
                background: 'linear-gradient(135deg, #D1E7DD 0%, #C3D5E8 30%, #D4D9F0 60%, #E8DFE0 100%)',
                overflow: 'hidden'
              }}>
                {/* More realistic map texture */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.08,
                  backgroundImage: 'linear-gradient(45deg, #1A365D 25%, transparent 25%, transparent 75%, #1A365D 75%, #1A365D), linear-gradient(45deg, #1A365D 25%, transparent 25%, transparent 75%, #1A365D 75%, #1A365D)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 10px 10px'
                }}></div>

                {/* District polygon outlines */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}>
                  <path d="M 100 80 L 180 60 L 200 120 L 150 140 Z" fill="none" stroke="#1A365D" strokeWidth="1.5" />
                  <path d="M 250 150 L 320 140 L 340 200 L 280 220 Z" fill="none" stroke="#1A365D" strokeWidth="1.5" />
                  <path d="M 150 250 L 220 240 L 240 310 L 170 320 Z" fill="none" stroke="#1A365D" strokeWidth="1.5" />
                  <path d="M 350 80 L 420 70 L 440 130 L 380 145 Z" fill="rgba(239, 68, 68, 0.1)" stroke="#EF4444" strokeWidth="2" />
                </svg>

                {/* Disaster Markers - More variety and realistic */}
                {[
                  { top: '18%', left: '22%', color: '#EF4444', label: 'EQ 6.8M', type: 'severe' },
                  { top: '28%', left: '68%', color: '#FF6B35', label: 'TC Cat 4', type: 'high' },
                  { top: '52%', left: '38%', color: '#F59E0B', label: 'Flood', type: 'medium' },
                  { top: '68%', left: '72%', color: '#EF4444', label: 'VO', type: 'severe' },
                  { top: '42%', left: '18%', color: '#10B981', label: 'DR', type: 'low' },
                  { top: '75%', left: '25%', color: '#F59E0B', label: 'WF', type: 'medium' },
                ].map((marker, idx) => (
                  <div key={idx} style={{
                    position: 'absolute',
                    top: marker.top,
                    left: marker.left,
                    transform: 'translate(-50%, -50%)',
                    animation: `pulse${idx % 5} 2s ease-in-out infinite`
                  }}>
                    <div style={{
                      width: marker.type === 'severe' ? '50px' : '40px',
                      height: marker.type === 'severe' ? '50px' : '40px',
                      borderRadius: '50%',
                      background: marker.color,
                      opacity: 0.25,
                      position: 'absolute'
                    }}></div>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: marker.color,
                      border: '2px solid white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-24px',
                        background: 'white',
                        padding: '3px 7px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 700,
                        color: marker.color,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Inter', sans-serif"
                      }}>
                        {marker.label}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Facility Square Markers (not house icons) */}
                {[
                  { top: '20%', left: '24%', impacted: true },
                  { top: '30%', left: '69%', impacted: true },
                  { top: '44%', left: '52%', impacted: false },
                  { top: '60%', left: '65%', impacted: false },
                  { top: '70%', left: '28%', impacted: false },
                  { top: '50%', left: '22%', impacted: true },
                ].map((facility, idx) => (
                  <div key={idx} style={{
                    position: 'absolute',
                    top: facility.top,
                    left: facility.left,
                    transform: 'translate(-50%, -50%)'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      background: facility.impacted ? '#EF4444' : '#10B981',
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      borderRadius: '2px'
                    }}></div>
                  </div>
                ))}

                {/* ACLED Conflict Markers (purple circular) */}
                {[
                  { top: '35%', left: '45%' },
                  { top: '58%', left: '80%' },
                  { top: '25%', left: '55%' },
                ].map((acled, idx) => (
                  <div key={idx} style={{
                    position: 'absolute',
                    top: acled.top,
                    left: acled.left,
                    transform: 'translate(-50%, -50%)'
                  }}>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#9333EA',
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(147, 51, 234, 0.4)',
                      opacity: 0.85
                    }}></div>
                  </div>
                ))}

                {/* Map Legend - Bottom Left */}
                <div style={{
                  position: 'absolute',
                  bottom: '80px',
                  left: '16px',
                  background: 'white',
                  borderRadius: '8px',
                  padding: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  fontSize: '9px',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: '#1A365D', fontSize: '10px' }}>Legend</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }}></div>
                      <span style={{ color: '#475569' }}>Severe</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF6B35' }}></div>
                      <span style={{ color: '#475569' }}>High</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', background: '#10B981', borderRadius: '1px' }}></div>
                      <span style={{ color: '#475569' }}>Facilities</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#9333EA' }}></div>
                      <span style={{ color: '#475569' }}>ACLED</span>
                    </div>
                  </div>
                </div>

                {/* Timeline Scrubber - Bottom */}
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '110px',
                  right: '16px',
                  background: 'white',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <div style={{
                    flex: 1,
                    height: '4px',
                    background: '#E5E7EB',
                    borderRadius: '2px',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '35%',
                      height: '100%',
                      background: '#FF6B35',
                      borderRadius: '2px'
                    }}></div>
                    <div style={{
                      position: 'absolute',
                      left: '35%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '12px',
                      height: '12px',
                      background: 'white',
                      border: '2px solid #FF6B35',
                      borderRadius: '50%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }}></div>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748B', fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap' }}>Mar 12 - Mar 15</span>
                </div>

                {/* Right Side Drawer - AI Analysis Panel */}
                <div style={{
                  position: 'absolute',
                  right: '16px',
                  top: '16px',
                  bottom: '16px',
                  width: '240px',
                  background: 'white',
                  borderRadius: '10px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Drawer Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1A365D 0%, #2D5A7B 100%)',
                    padding: '12px 14px',
                    color: 'white'
                  }}>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: '14px',
                      marginBottom: '4px'
                    }}>
                      AI Analysis
                    </div>
                    <div style={{
                      fontSize: '10px',
                      opacity: 0.9,
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      Operational Outlook
                    </div>
                  </div>

                  {/* Analysis Content */}
                  <div style={{ padding: '12px', flex: 1, overflow: 'hidden' }}>
                    {/* Section Header */}
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#1A365D',
                      marginBottom: '8px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      Most Likely Scenario
                    </div>
                    <div style={{
                      fontSize: '10px',
                      lineHeight: '1.5',
                      color: '#475569',
                      marginBottom: '12px',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      Moderate flooding affects 3-5 districts. Impact on 25-40 facilities within 72 hours.
                    </div>

                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#1A365D',
                      marginBottom: '8px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      Key Recommendations
                    </div>
                    <div style={{
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      padding: '8px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontSize: '9px', fontWeight: 600, color: '#DC2626', marginBottom: '4px', fontFamily: "'Inter', sans-serif" }}>
                        IMMEDIATE
                      </div>
                      <div style={{ fontSize: '10px', color: '#475569', fontFamily: "'Inter', sans-serif" }}>
                        Pre-position supplies in northern districts
                      </div>
                    </div>
                    <div style={{
                      background: '#FEF3E2',
                      border: '1px solid #FCD34D',
                      borderRadius: '6px',
                      padding: '8px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ fontSize: '9px', fontWeight: 600, color: '#D97706', marginBottom: '4px', fontFamily: "'Inter', sans-serif" }}>
                        24-48 HOURS
                      </div>
                      <div style={{ fontSize: '10px', color: '#475569', fontFamily: "'Inter', sans-serif" }}>
                        Activate emergency response teams
                      </div>
                    </div>

                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#1A365D',
                      marginBottom: '6px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      Risk Factors
                    </div>
                    <div style={{ fontSize: '10px', lineHeight: '1.5', color: '#475569', fontFamily: "'Inter', sans-serif" }}>
                      • Weather escalation risk: 35%<br />
                      • Security concerns in 2 districts<br />
                      • Limited road access due to flooding
                    </div>
                  </div>

                  {/* Bottom Action */}
                  <div style={{
                    borderTop: '1px solid #E5E7EB',
                    padding: '10px'
                  }}>
                    <button style={{
                      width: '100%',
                      background: '#FF6B35',
                      color: 'white',
                      border: 'none',
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: "'Space Grotesk', sans-serif",
                      cursor: 'pointer'
                    }}>
                      View Full Report
                    </button>
                  </div>
                </div>

                {/* Floating Action Buttons - Left Side */}
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A365D" strokeWidth="2">
                      <path d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                  </div>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A365D" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>

                {/* Stats Bar - Bottom Right (above timeline) */}
                <div style={{
                  position: 'absolute',
                  bottom: '60px',
                  right: '16px',
                  background: 'white',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  display: 'flex',
                  gap: '12px',
                  fontSize: '10px',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  <div>
                    <div style={{ color: '#94A3B8', marginBottom: '3px', fontSize: '8px', fontWeight: 600 }}>TOTAL</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1A365D', fontFamily: "'Space Grotesk', sans-serif" }}>245</div>
                  </div>
                  <div style={{ width: '1px', background: '#E5E7EB' }}></div>
                  <div>
                    <div style={{ color: '#94A3B8', marginBottom: '3px', fontSize: '8px', fontWeight: 600 }}>IMPACTED</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#EF4444', fontFamily: "'Space Grotesk', sans-serif" }}>34</div>
                  </div>
                  <div style={{ width: '1px', background: '#E5E7EB' }}></div>
                  <div>
                    <div style={{ color: '#94A3B8', marginBottom: '3px', fontSize: '8px', fontWeight: 600 }}>SAFE</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#10B981', fontFamily: "'Space Grotesk', sans-serif" }}>211</div>
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
                <li>ACLED CSV upload support</li>
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
                <span style={experimentalBadgeStyle}>Experimental</span>
              </h3>
              <ul style={{
                color: '#475569',
                fontSize: '16px',
                lineHeight: '1.8',
                paddingLeft: '20px'
              }}>
                <li>Operational Outlook with 3 scenarios</li>
                <li>14-day weather forecasts for planning</li>
                <li>Timeline playback for temporal analysis</li>
                <li>Real-time web search for current events</li>
                <li>Campaign viability (GO/CAUTION/DELAY/NOGO)</li>
                <li>Disease outbreak risk indicators</li>
                <li>Supply chain disruption early warnings</li>
                <li>Weather-based hazard monitoring</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section style={{
        padding: '100px 20px',
        background: 'linear-gradient(135deg, #1A365D 0%, #2D5A7B 100%)',
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

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(255, 107, 53, 0.2)',
              border: '1px solid rgba(255, 107, 53, 0.4)',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '20px',
              fontFamily: "'Inter', sans-serif"
            }}>
              COMPREHENSIVE FEATURE SET
            </div>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '48px',
              color: 'white',
              marginBottom: '20px',
              letterSpacing: '-0.01em'
            }}>
              Everything You Need for <span style={{ color: '#FF6B35' }}>Data-Driven Decisions</span>
            </h2>
            <p style={{
              fontSize: '20px',
              color: 'rgba(255, 255, 255, 0.85)',
              maxWidth: '700px',
              margin: '0 auto',
              lineHeight: '1.7'
            }}>
              From population analysis to outbreak prediction, all the tools humanitarian teams need in one platform
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '28px'
          }}>
            {[
              {
                title: 'WorldPop Integration',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                description: 'Google Earth Engine-powered population statistics with age-sex breakdowns',
                features: [
                  'Real-time population heatmaps',
                  'Vulnerable population identification (under-5, over-60)',
                  'Age-sex demographic breakdowns',
                  'District-level population statistics'
                ]
              },
              {
                title: 'Disease Outbreak Risk Analysis',
                experimental: true,
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
                description: 'Early warning indicators for epidemic risk based on weather and disaster conditions',
                features: [
                  'Cholera risk assessment (flood-related)',
                  'Malaria transmission risk indicators',
                  'Measles outbreak vulnerability analysis',
                  'Diarrheal disease early warnings'
                ]
              },
              {
                title: 'Campaign Viability Assessment',
                experimental: true,
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                description: 'GO/CAUTION/DELAY/NOGO decisions for campaign planning',
                features: [
                  'Multi-facility batch assessment',
                  'District-level campaign readiness',
                  'Operation-specific risk scoring',
                  'HTML/PDF decision brief export'
                ]
              },
              {
                title: 'Supply Chain Forecasting',
                experimental: true,
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>,
                description: '7-14 day ahead supply chain disruption predictions',
                features: [
                  'Cold chain risk assessment',
                  'Road access disruption forecasts',
                  'Air transport availability predictions',
                  'Multi-hazard supply route analysis'
                ]
              },
              {
                title: 'Advanced Security Analysis',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                description: 'Security risk scoring from uploaded ACLED CSV exports with proximity zones',
                features: [
                  'Upload ACLED CSV files downloaded from your ACLED account',
                  'Filter uploaded events by country in-app',
                  'Security zones (0-10km, 10-25km, 25-50km, 50-100km)',
                  'CRITICAL/HIGH/MEDIUM/LOW classifications',
                  'Incident aggregation by zone'
                ]
              },
              {
                title: 'Drawing & Annotation Tools',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
                description: 'Freehand drawing tools for operational planning',
                features: [
                  'Customizable colors',
                  'Area measurement',
                  'Route planning',
                  'Annotation persistence'
                ]
              },
              {
                title: 'Timeline Visualization',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                description: 'Replay disaster evolution with adjustable playback speed',
                features: [
                  'Progressive event visualization',
                  'Speed control (0.5x to 2x)',
                  'Play/pause animation',
                  'Temporal pattern analysis'
                ]
              },
              {
                title: 'AI Chatbot with Web Search',
                experimental: true,
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/></svg>,
                description: 'Context-aware AI assistant with real-time information',
                features: [
                  'Real-time web search integration',
                  'District interaction intents',
                  'Streaming responses',
                  'Context-aware recommendations'
                ]
              },
              {
                title: 'Disaster Risk Monitoring',
                experimental: true,
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
                description: '14-day weather-based risk indicators for emerging hazards',
                features: [
                  'Flood risk indicators from rainfall forecasts',
                  'Drought condition monitoring',
                  'Cyclone seasonal risk assessment',
                  'Heatwave early warnings'
                ]
              },
              {
                title: 'Multiple Basemap Options',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
                description: 'Switch between satellite, terrain, and street maps',
                features: [
                  'OpenStreetMap standard view',
                  'Satellite imagery',
                  'Terrain visualization',
                  'Heatmap overlay toggle'
                ]
              },
              {
                title: 'Multiple Operation Types',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 21V9"/></svg>,
                description: 'Pre-configured analysis templates for major humanitarian operations',
                features: [
                  'Immunization campaigns',
                  'Malaria control',
                  'WASH interventions',
                  'Mental health & psychosocial support',
                  'Nutrition/RUTF distribution',
                  'Disease surveillance'
                ]
              },
              {
                title: 'Export & Reporting',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
                description: 'Generate decision briefs and campaign readiness reports',
                features: [
                  'HTML/PDF export',
                  'Individual facility briefs',
                  'System-wide readiness reports',
                  'Custom report templates'
                ]
              }
            ].map((feature, idx) => (
              <div key={idx} style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.5)';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              >
                <div style={{ marginBottom: '16px' }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '22px',
                  color: 'white',
                  marginBottom: '12px'
                }}>
                  {feature.title}
                  {feature.experimental && (
                    <span style={experimentalBadgeStyle}>Experimental</span>
                  )}
                </h3>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '15px',
                  lineHeight: '1.7',
                  marginBottom: '20px'
                }}>
                  {feature.description}
                </p>
                <ul style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '14px',
                  lineHeight: '2',
                  paddingLeft: 0,
                  margin: 0,
                  listStyle: 'none'
                }}>
                  {feature.features.map((item, i) => (
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
                title: 'Immunization Campaigns',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2l4 4M7.5 12.5l-4 4M4.5 16.5L2 19l3 3 2.5-2.5M9 6l6 6M16.5 7.5l3-3L22 7l-3 3"/><path d="M7 7l9 9"/></svg>,
                description: 'Track vaccination coverage, map refusals, quantify missed children, and pause campaigns in conflict zones',
                features: ['Campaign coverage tracking', 'Refusal hotspot mapping', 'Conflict impact analysis', 'Catch-up needs calculation'],
                example: 'Calculate total missed children in districts affected by 14+ day interruptions'
              },
              {
                title: 'Cholera/OCV Response',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
                description: 'Joint WASH-OCV planning for flood-affected areas with disease surveillance integration',
                features: ['Flood-cholera correlation', 'WASH access mapping', 'OCV prioritization', 'Emergency response targeting'],
                example: 'Identify districts with floods + low WASH + high cholera cases needing urgent intervention'
              },
              {
                title: 'Humanitarian Access',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                description: 'Safety assessments for field teams with real-time conflict tracking and district risk scoring',
                features: ['ACLED conflict events', 'No-go zone identification', 'Route safety scoring', 'Access timeline planning'],
                example: 'Show which supply routes are safe this week based on recent security incidents'
              },
              {
                title: 'Supply Chain Risk',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
                description: 'Identify warehouse vulnerabilities and predict disruptions from disasters and conflict',
                features: ['Pre-positioning recommendations', 'Route risk assessment', 'Disruption forecasting', 'Multi-hazard analysis'],
                example: 'Predict supply disruptions for next 2 weeks based on weather patterns and conflict trends'
              },
              {
                title: 'Disease Surveillance',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                description: 'Map outbreak hotspots, track transmission patterns, and plan rapid response deployments',
                features: ['Case clustering analysis', 'Transmission corridors', 'Coverage gap correlation', 'Zero-dose targeting'],
                example: 'Identify polio transmission corridors and recommend rapid response team locations'
              },
              {
                title: 'Multi-Sector Assessment',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                description: 'Integrated analysis across health, WASH, protection, and shelter with weather-aware forward-looking scenarios',
                features: ['Operational Outlook', 'Weather-integrated planning', 'Timeline playback analysis', 'Early warning indicators'],
                example: 'Generate operational outlook with weather forecasts to plan campaigns for the next 2 weeks'
              },
              {
                title: 'Malaria Control',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z"/><path d="M12 6v6l4 2"/></svg>,
                description: 'ITN distribution planning with environmental risk assessment',
                features: ['Vector breeding site analysis', 'Seasonal transmission forecasting', 'Distribution network optimization', 'Flood impact on ITN campaigns'],
                example: 'Identify high-transmission zones requiring urgent ITN distribution before rainy season'
              },
              {
                title: 'WASH Interventions',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
                description: 'Water point vulnerability and emergency WASH needs assessment',
                features: ['Flood-affected water point mapping', 'Contamination risk zones', 'Emergency latrine needs calculation', 'Hygiene kit distribution planning'],
                example: 'Calculate emergency WASH needs for flood-affected districts with damaged water infrastructure'
              },
              {
                title: 'Mental Health & Psychosocial Support',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
                description: 'Trauma-affected population mapping and service gap analysis',
                features: ['Conflict-affected area prioritization', 'Service coverage gap analysis', 'Safe space site selection', 'Counselor deployment planning'],
                example: 'Identify districts with high conflict exposure and no MHPSS services'
              },
              {
                title: 'Nutrition/RUTF Distribution',
                icon: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>,
                description: 'Acute malnutrition response with supply chain optimization',
                features: ['Drought-malnutrition correlation', 'RUTF cold chain risk assessment', 'Distribution site accessibility', 'SAM case load forecasting'],
                example: 'Predict SAM caseload increase in drought-affected districts and plan RUTF pre-positioning'
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
                  marginBottom: '20px',
                  lineHeight: 1
                }}>
                  {useCase.icon}
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
                  marginBottom: '20px',
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
                {useCase.example && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    background: '#F8FAFC',
                    borderLeft: '3px solid #FF6B35',
                    borderRadius: '6px'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#FF6B35',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      textTransform: 'uppercase'
                    }}>
                      Example Query
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#475569',
                      lineHeight: '1.6',
                      fontStyle: 'italic'
                    }}>
                      "{useCase.example}"
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Data Flexibility Section */}
      <section style={{
        padding: '100px 20px',
        background: 'white'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block',
              background: '#1A365D',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '20px',
              fontFamily: "'Inter', sans-serif"
            }}>
              DATA-AGNOSTIC APPROACH
            </div>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '48px',
              color: '#0F172A',
              marginBottom: '20px',
              letterSpacing: '-0.01em'
            }}>
              Upload <span style={{ color: '#FF6B35' }}>Any Data</span>, Get Instant Intelligence
            </h2>
            <p style={{
              fontSize: '20px',
              color: '#475569',
              maxWidth: '700px',
              margin: '0 auto',
              lineHeight: '1.7'
            }}>
              No custom development needed. Upload any CSV with coordinates and select which columns to analyze.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
            marginBottom: '60px'
          }}>
            {[
              {
                step: '1',
                title: 'Upload Your Data',
                description: 'Any CSV with lat/long: facilities, vaccination sites, warehouses, disease cases, etc.',
                icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              },
              {
                step: '2',
                title: 'Select AI Fields',
                description: 'Choose columns for AI analysis: population, coverage, cases, refusals, partner, etc.',
                icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              },
              {
                step: '3',
                title: 'Add Context Layers',
                description: 'Upload ACLED CSV exports and admin boundaries for district-level risk assessment and country filtering',
                icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              },
              {
                step: '4',
                title: 'Ask Questions',
                description: 'Natural language queries: "Which districts need catch-up campaigns?"',
                icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              }
            ].map((step, idx) => (
              <div key={idx} style={{
                background: '#F8FAFC',
                padding: '28px',
                borderRadius: '12px',
                border: '2px solid #E5E7EB',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '20px',
                  background: '#FF6B35',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px'
                }}>
                  {step.step}
                </div>
                <div style={{ marginBottom: '12px' }}>{step.icon}</div>
                <h4 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '18px',
                  color: '#1A365D',
                  marginBottom: '8px'
                }}>
                  {step.title}
                </h4>
                <p style={{
                  fontSize: '14px',
                  color: '#64748B',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {/* Visual Guide */}
          <div style={{
            background: 'linear-gradient(135deg, #1A365D 0%, #2D4A7C 100%)',
            borderRadius: '16px',
            padding: '48px',
            color: 'white'
          }}>
            <h3 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '28px',
              marginBottom: '32px',
              textAlign: 'center'
            }}>
              Visual Differentiation at a Glance
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '32px'
            }}>
              {[
                {
                  label: 'Facilities',
                  shape: 'square',
                  colors: [
                    { label: 'Safe', color: '#4CAF50' },
                    { label: 'Impacted', color: '#ff4444' }
                  ],
                  description: 'Square markers'
                },
                {
                  label: 'ACLED Events',
                  shape: 'circle',
                  colors: [
                    { label: 'Battles', color: '#d32f2f' },
                    { label: 'Violence', color: '#ff6f00' },
                    { label: 'Protests', color: '#fbc02d' }
                  ],
                  description: 'Circular markers'
                },
                {
                  label: 'District Risk',
                  shape: 'polygon',
                  colors: [
                    { label: 'None', color: '#4A90E2' },
                    { label: 'Low', color: '#7cb342' },
                    { label: 'Medium', color: '#fdd835' },
                    { label: 'High', color: '#fb8c00' },
                    { label: 'Very High', color: '#e53935' }
                  ],
                  description: 'Filled polygons'
                }
              ].map((item, idx) => (
                <div key={idx} style={{
                  textAlign: 'left',
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  minHeight: '100%'
                }}>
                  <div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      marginBottom: '6px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontStyle: 'italic'
                    }}>
                      {item.description}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    {item.colors.map((colorItem, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            background: colorItem.color,
                            borderRadius: item.shape === 'circle' ? '50%' : item.shape === 'square' ? '2px' : '1px',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            flexShrink: 0
                          }}></div>
                          <span>{colorItem.label}</span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.55)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          flexShrink: 0
                        }}>
                          {item.shape}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documentation Link */}
          <div style={{
            marginTop: '48px',
            textAlign: 'center'
          }}>
            <a
              href="https://github.com/jmesplana/gdacs_ai/blob/main/IMMUNIZATION_USE_CASE.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <button style={{
                background: 'white',
                border: '2px solid #FF6B35',
                color: '#FF6B35',
                padding: '14px 32px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontFamily: "'Space Grotesk', sans-serif"
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#FF6B35';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white';
                e.target.style.color = '#FF6B35';
              }}
              >
                📖 Read the Immunization Use Case Guide
              </button>
            </a>
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
            From Data to Decision in Five Steps
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
                title: 'View Global Disasters & Conflicts',
                description: 'Access live GDACS disaster data, then upload ACLED CSV exports from your ACLED account to add conflict events and filter them by country'
              },
              {
                title: 'Upload Your Data & Analyze Population',
                description: 'Import facility locations from CSV/Excel, upload shapefiles for district boundaries, and visualize WorldPop demographic data with age-sex breakdowns'
              },
              {
                title: 'Automatic Multi-Layer Impact Assessment',
                description: 'System calculates disaster proximity, security zones (0-10km, 10-25km, 25-50km, 50-100km), and population-at-risk for all uploaded facilities'
              },
              {
                title: 'Get AI-Powered Forecasts & Campaign Decisions',
                description: 'Generate experimental outbreak predictions (30 days), supply chain forecasts (7-14 days), and GO/CAUTION/DELAY/NOGO campaign viability decisions with weather integration'
              },
              {
                title: 'Visualize Trends & Export Reports',
                description: 'Use timeline playback (0.5x-2x speed) to replay disaster evolution, draw annotations on maps, and export HTML/PDF decision briefs for stakeholders'
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
            Trusted Global Data Sources
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '32px'
          }}>
            {/* GDACS */}
            <div style={{
              background: 'white',
              padding: '36px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: '#1A365D',
                marginBottom: '12px'
              }}>
                GDACS
              </h3>
              <p style={{
                fontSize: '13px',
                color: '#94A3B8',
                marginBottom: '18px',
                fontStyle: 'italic'
              }}>
                Global Disaster Alert and Coordination System
              </p>
              <ul style={{
                color: '#475569',
                fontSize: '15px',
                lineHeight: '1.8',
                paddingLeft: '20px',
                margin: 0
              }}>
                <li>UN-backed disaster monitoring</li>
                <li>7 disaster types tracked</li>
                <li>Updated continuously</li>
                <li>CAP XML precision polygons</li>
              </ul>
              <div style={{ marginTop: '20px' }}>
                <a
                  href="https://www.gdacs.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#1A365D',
                    fontSize: '14px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  Visit GDACS
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            {/* ACLED */}
            <div style={{
              background: 'white',
              padding: '36px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: '#1A365D',
                marginBottom: '12px'
              }}>
                ACLED
              </h3>
              <p style={{
                fontSize: '13px',
                color: '#94A3B8',
                marginBottom: '18px',
                fontStyle: 'italic'
              }}>
                Armed Conflict Location & Event Data Project
              </p>
              <ul style={{
                color: '#475569',
                fontSize: '15px',
                lineHeight: '1.8',
                paddingLeft: '20px',
                margin: 0
              }}>
                <li>CSV exports downloaded with your ACLED account</li>
                <li>Upload into the app for conflict overlays</li>
                <li>Filter uploaded events by country</li>
                <li>Geo-coded event precision</li>
              </ul>
              <div style={{ marginTop: '20px' }}>
                <a
                  href="https://acleddata.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#1A365D',
                    fontSize: '14px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  Get ACLED data
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            {/* WorldPop */}
            <div style={{
              background: 'white',
              padding: '36px',
              borderRadius: '12px',
              border: '1px solid #94A3B8'
            }}>
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: '#1A365D',
                marginBottom: '12px'
              }}>
                WorldPop
              </h3>
              <p style={{
                fontSize: '13px',
                color: '#94A3B8',
                marginBottom: '18px',
                fontStyle: 'italic'
              }}>
                WorldPop Global 2 via Google Earth Engine
              </p>
              <ul style={{
                color: '#475569',
                fontSize: '15px',
                lineHeight: '1.8',
                paddingLeft: '20px',
                margin: 0
              }}>
                <li>High-resolution population grids</li>
                <li>Age and sex disaggregation</li>
                <li>Global coverage</li>
                <li>App supports 2015-2030 WorldPop years</li>
              </ul>
              <p style={{
                marginTop: '18px',
                marginBottom: 0,
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#64748B'
              }}>
                This app uses WorldPop Global 2 collections through Google Earth Engine, including total population and age-sex layers across the 2015-2030 range.
              </p>
              <div style={{
                marginTop: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <a
                  href="https://www.worldpop.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#1A365D',
                    fontSize: '14px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  Visit WorldPop
                  <span aria-hidden="true">↗</span>
                </a>
                <a
                  href="https://gee-community-catalog.org/projects/worldpop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#1A365D',
                    fontSize: '14px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  View exact GEE collections used
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
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
                answer: 'The Operational Outlook is an experimental AI feature that generates forward-looking humanitarian analysis with 3 scenarios (most likely, escalation, stabilization), early warning indicators, and operational implications. It helps you anticipate what\'s coming next, not just what happened.'
              },
              {
                question: 'How does WorldPop integration work?',
                answer: 'The platform integrates Google Earth Engine to provide real-time population statistics including total population, age-sex breakdowns, and vulnerable population counts (under-5, over-60). Population heatmaps visualize demographic density across your operational area, helping identify high-impact zones for interventions.'
              },
              {
                question: 'How does disease outbreak risk analysis work?',
                answer: 'The platform provides early warning indicators for cholera, malaria, measles, and diarrheal diseases based on environmental conditions (floods, droughts, temperature, rainfall) and disaster impacts. These are directional risk indicators for planning purposes, not validated epidemiological predictions. Use them to prioritize preparedness activities and identify vulnerable areas.'
              },
              {
                question: 'What is Campaign Viability Assessment?',
                answer: 'Campaign Viability provides GO/CAUTION/DELAY/NOGO decisions for humanitarian campaigns. You can assess individual facilities or batch-process 1000+ sites simultaneously. The system evaluates security risks, disaster impacts, accessibility, and population data to generate decision briefs exportable as HTML/PDF.'
              },
              {
                question: 'How does weather forecast integration work?',
                answer: 'The AI chatbot integrates 2-week weather forecasts for your operational area and districts. It automatically generates warnings for flood risk, disease outbreak conditions, heat stress, and cold chain risks. Ask questions like "Can I run campaigns this week?" or "Which districts have flood risk?"'
              },
              {
                question: 'What is Timeline Playback?',
                answer: 'Timeline Playback lets you replay disasters and conflict events over time with adjustable speed controls (0.5x to 2x). Watch how disasters evolved, identify progression patterns, and understand temporal relationships between events. Perfect for after-action reviews and historical analysis.'
              },
              {
                question: 'How does the AI use real-time web search?',
                answer: 'The AI assistant can search the web for current humanitarian events, recent outbreak data, and breaking news to supplement its analysis. This experimental capability helps ground recommendations in current information, but results should still be reviewed by an operator before action.'
              },
              {
                question: 'What are the drawing tools used for?',
                answer: 'Drawing tools allow you to annotate maps with freehand drawings, measure areas, plan routes, and mark zones of interest. Choose custom colors for different annotations and persist drawings across sessions for ongoing operational planning.'
              },
              {
                question: 'How does security risk scoring work with ACLED data?',
                answer: 'Download an ACLED CSV export using your ACLED account, upload it into the app, and then filter the uploaded events by country. The platform uses those uploaded conflict events to create proximity zones (0-10km, 10-25km, 25-50km, 50-100km) around facilities and classify security levels based on incident type, recency, and proximity.'
              },
              {
                question: 'Can I batch-assess multiple facilities?',
                answer: 'Absolutely! Upload CSV files with 1000+ facilities and run batch campaign viability assessments. The system processes all sites simultaneously and generates individual decision briefs plus a system-wide readiness report, helping prioritize which locations to operate in.'
              },
              {
                question: 'What operation types are supported?',
                answer: 'Pre-configured templates exist for Immunization, Cholera/OCV, Malaria Control, WASH, Mental Health & Psychosocial Support, Nutrition/RUTF Distribution, and Disease Surveillance. Each template has operation-specific risk factors and decision criteria.'
              },
              {
                question: 'Can I use my own facility data?',
                answer: 'Yes, upload any CSV or Excel file with name, latitude, and longitude columns. You can also upload shapefiles for district boundaries to get district-level risk assessments, population statistics, and weather forecasts.'
              },
              {
                question: 'Is my data stored on servers?',
                answer: 'Facility data is cached locally in your browser only. No server-side storage. However, when using AI features, data is temporarily sent to OpenAI for analysis. Drawings and annotations are stored in browser local storage.'
              },
              {
                question: 'Can the platform forecast supply chain disruptions?',
                answer: 'Yes! The supply chain forecast analyzes cold chain risks, road access disruptions, and air transport availability 7-14 days ahead. It considers weather patterns, conflict trends, and disaster impacts to predict logistics challenges and recommend pre-positioning strategies.'
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
                Launch App →
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
