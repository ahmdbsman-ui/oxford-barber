import React, { useEffect, useMemo, useRef, useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getCurrentBusinessStatus } from '../utils/businessStatus';

const SERVICES = [
  { id: 1, num: '01', name: 'Beard Trim', price: 25, duration: '20 min', desc: 'Clean shaping and detailing for a sharp beard.' },
  { id: 2, num: '02', name: 'Buzz Cut', price: 25, duration: '20 min', desc: 'Simple, clean and low-maintenance cut.' },
  { id: 3, num: '03', name: 'Regular Hair Cut', price: 40, duration: '30 min', desc: 'Classic haircut tailored to your style.' },
  { id: 4, num: '04', name: 'Zero Fade', price: 45, duration: '30 min', desc: 'Sharp fade with clean blending.' },
  { id: 5, num: '05', name: 'Skin Fade', price: 50, duration: '30 min', desc: 'Premium fade with detailed finish.' },
  { id: 6, num: '06', name: 'Scissor Cut', price: 50, duration: '30 min', desc: 'Scissor-only cut for natural shape.' },
];

export default function Home() {
  const ADMIN_EMAILS = (
    process.env.REACT_APP_ADMIN_EMAILS ||
    process.env.REACT_APP_ADMIN_EMAIL ||
    '629ahmdbsman@gmail.com,Basmanaljumayli51@gmail.com'
  )
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  const navigate = useNavigate();
  const [tapCount, setTapCount] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [galleryItems, setGalleryItems] = useState([]);
  const [siteSettings, setSiteSettings] = useState({
    happyClients: '500+',
    rating: '5.0',
    experience: '8+',
    vacationMode: false,
  });
  const [scheduledClosures, setScheduledClosures] = useState([]);
  const [currentBusinessStatusTime, setCurrentBusinessStatusTime] = useState(
    () => new Date()
  );
  const pressTimer = useRef(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentBusinessStatusTime(new Date());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const businessStatus = useMemo(
    () =>
      getCurrentBusinessStatus({
        vacationMode: Boolean(siteSettings.vacationMode),
        scheduledClosures,
        now: currentBusinessStatusTime,
      }),
    [currentBusinessStatusTime, scheduledClosures, siteSettings.vacationMode]
  );

  const businessStatusDebugText = businessStatus.reason || 'unknown_status';

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'siteConfig', 'settings'),
      (snapshot) => {
        if (snapshot.exists()) {
          setSiteSettings((prev) => ({
            ...prev,
            ...snapshot.data(),
          }));
        }
      },
      (error) => {
        console.error('Error listening to site settings:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'scheduledClosures'),
      (snapshot) => {
        const nextClosures = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));
        setScheduledClosures(nextClosures);
      },
      (error) => {
        console.error('Error listening to scheduled closures:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'reviews'));
        const visibleReviews = snapshot.docs
          .map((item) => item.data())
          .filter((item) => item.isVisible)
          .sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
        setReviews(visibleReviews);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      }
    };

    fetchReviews();
  }, []);

  useEffect(() => {
    const fetchGalleryItems = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'gallery'));
        const visibleItems = snapshot.docs
          .map((item) => item.data())
          .filter((item) => item.isVisible)
          .sort((a, b) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          );
        setGalleryItems(visibleItems);
      } catch (error) {
        console.error('Error fetching gallery items:', error);
      }
    };

    fetchGalleryItems();
  }, []);

  const handleBook = (svc) => {
    localStorage.setItem('selectedServices', JSON.stringify([svc]));
    localStorage.setItem('selectedService', JSON.stringify(svc));
    navigate('/booking');
  };

  const handleLogoClick = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= 5) {
      setShowAdminModal(true);
      setTapCount(0);
      setAdminError('');
    }

    setTimeout(() => {
      setTapCount(0);
    }, 1800);
  };

  const handlePressStart = () => {
    pressTimer.current = setTimeout(() => {
      setShowAdminModal(true);
      setAdminError('');
    }, 3000);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();

    try {
      let signedIn = false;

      for (const adminEmail of ADMIN_EMAILS) {
        try {
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          signedIn = true;
          break;
        } catch (error) {
          if (
            error.code !== 'auth/invalid-credential' &&
            error.code !== 'auth/user-not-found' &&
            error.code !== 'auth/wrong-password' &&
            error.code !== 'auth/invalid-login-credentials'
          ) {
            throw error;
          }
        }
      }

      if (!signedIn) {
        setAdminError('Wrong password');
        return;
      }

      sessionStorage.setItem('oxfordAdminAuth', 'true');
      sessionStorage.setItem('oxfordAdminAuthTime', String(Date.now()));
      setShowAdminModal(false);
      setAdminPassword('');
      setAdminError('');
      navigate('/admin');
    } catch (error) {
      console.error('Error signing in admin:', error);
      setAdminError('Wrong password');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: "'Inter', sans-serif",
        background:
          'radial-gradient(circle at top left, #1a1a1a 0%, #0b0b0b 45%, #050505 100%)',
        color: '#fff',
        overflowX: 'hidden',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cinzel:wght@600;700;800&display=swap"
        rel="stylesheet"
      />

      <style>{`
        html {
          scroll-behavior: smooth;
        }

        .home-nav,
        .home-hero,
        .home-section,
        .home-card-grid,
        .home-stats-grid,
        .home-modal,
        .home-hero-copy,
        .home-hero-visual {
          min-width: 0;
          box-sizing: border-box;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(32px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.04);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes floatGlow {
          0% {
            transform: translateY(0px);
            opacity: 0.8;
          }
          50% {
            transform: translateY(-10px);
            opacity: 1;
          }
          100% {
            transform: translateY(0px);
            opacity: 0.8;
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @keyframes poleSpin {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 0 220px;
          }
        }

        @media (max-width: 1024px) {
          .home-nav {
            padding: 18px 20px !important;
          }

          .home-hero {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding: 118px 20px 48px !important;
            min-height: auto !important;
          }

          .home-hero-copy {
            padding-right: 0 !important;
          }

          .home-hero-visual {
            justify-self: stretch !important;
            max-width: 100% !important;
            min-height: 460px !important;
          }

          .home-section {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          .home-modal {
            max-width: 100% !important;
          }
        }

        @media (max-width: 768px) {
          .home-stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important;
          }

          .home-card-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <nav
        className="home-nav"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 48px',
          background: 'rgba(8,8,8,0.78)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(198,161,91,0.18)',
          animation: 'fadeIn 0.8s ease',
        }}
      >
        <div
          onClick={handleLogoClick}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: '2rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          Oxford <span style={{ color: '#C6A15B' }}>Barber</span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '32px',
            alignItems: 'center',
          }}
        >
          {['Services', 'About'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              style={{
                color: '#D7D7D7',
                textDecoration: 'none',
                fontSize: '0.92rem',
                fontWeight: 500,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {item}
            </a>
          ))}

          <button
            onClick={() => navigate('/booking')}
            style={{
              background:
                'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
              color: '#0B0B0B',
              padding: '14px 26px',
              borderRadius: '999px',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(198,161,91,0.28)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
              e.currentTarget.style.boxShadow =
                '0 14px 36px rgba(198,161,91,0.36)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow =
                '0 10px 30px rgba(198,161,91,0.28)';
            }}
          >
            Book Now
          </button>
        </div>
      </nav>

      <section
        className="home-hero"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: '36px',
          minHeight: '100vh',
          padding: '130px 48px 60px',
          alignItems: 'center',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        <div className="home-hero-copy" style={{ paddingRight: '20px', minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              color: '#C6A15B',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontSize: '0.82rem',
              marginBottom: '26px',
              animation: 'fadeUp 0.8s ease',
            }}
          >
            <span
              style={{
                width: '44px',
                height: '1px',
                background: '#C6A15B',
                display: 'inline-block',
              }}
            ></span>
            Premium Men’s Grooming
          </div>

          <h1
            style={{
              fontSize: 'clamp(3rem, 6vw, 5.5rem)',
              lineHeight: 0.95,
              margin: 0,
              fontWeight: 800,
              animation: 'fadeUp 1s ease',
              textWrap: 'balance',
            }}
          >
            <span style={{ display: 'block', color: '#FFFFFF' }}>
              Sharp cuts.
            </span>
            <span style={{ display: 'block', color: '#FFFFFF' }}>
              Clean fades.
            </span>
            <span
              style={{
                display: 'block',
                color: '#C6A15B',
                textShadow: '0 0 24px rgba(198,161,91,0.18)',
              }}
            >
              Timeless style.
            </span>
          </h1>

          <p
            style={{
              color: '#B8B8B8',
              fontSize: '1.1rem',
              lineHeight: 1.75,
              maxWidth: '580px',
              marginTop: '28px',
              marginBottom: '0',
              animation: 'fadeUp 1.2s ease',
            }}
          >
            Premium barbering in Sydney with clean finishes, sharp detailing and
            a simple booking experience built for real clients.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              marginTop: '34px',
              animation: 'fadeUp 1.35s ease',
            }}
          >
            <button
              onClick={() => navigate('/booking')}
              style={{
                background:
                  'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                color: '#0B0B0B',
                padding: '16px 34px',
                borderRadius: '999px',
                border: 'none',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 12px 36px rgba(198,161,91,0.24)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform =
                  'translateY(-3px) scale(1.04)';
                e.currentTarget.style.boxShadow =
                  '0 18px 42px rgba(198,161,91,0.34)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow =
                  '0 12px 36px rgba(198,161,91,0.24)';
              }}
            >
              Book Your Visit
            </button>

            <a
              href="#services"
              style={{
                padding: '15px 30px',
                borderRadius: '999px',
                border: '1px solid rgba(198,161,91,0.45)',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.98rem',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(198,161,91,0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              View Services
            </a>
          </div>

          <div
            className="home-stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))',
              gap: '18px',
              marginTop: '42px',
              animation: 'fadeUp 1.5s ease',
            }}
          >
            {[
              { value: siteSettings.happyClients, label: 'Happy Clients' },
              { value: siteSettings.rating, label: 'Rating' },
              { value: siteSettings.experience, label: 'Years Experience' },
            ].map((item) => (
              <div
                key={item.value}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(198,161,91,0.12)',
                  borderRadius: '18px',
                  padding: '18px 16px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                }}
              >
                <div
                  style={{
                    color: '#FFFFFF',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  {item.value}
                </div>
                <div
                  style={{
                    color: '#9A9A9A',
                    fontSize: '0.86rem',
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            minHeight: '620px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeUp 1.15s ease',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '78%',
              height: '78%',
              borderRadius: '28px',
              background:
                'radial-gradient(circle, rgba(198,161,91,0.12) 0%, rgba(198,161,91,0.02) 60%, rgba(198,161,91,0) 100%)',
              filter: 'blur(10px)',
              animation: 'floatGlow 4s ease-in-out infinite',
            }}
          ></div>

        <div
          className="home-hero-visual"
          style={{
            position: 'relative',
            width: '100%',
              maxWidth: '500px',
              minHeight: '560px',
              borderRadius: '30px',
              background:
                'linear-gradient(180deg, rgba(24,24,24,0.96) 0%, rgba(10,10,10,0.98) 100%)',
              border: '1px solid rgba(198,161,91,0.16)',
              boxShadow:
                '0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02) inset',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '34px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.03) 20%, transparent 40%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 7s linear infinite',
                pointerEvents: 'none',
              }}
            ></div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: businessStatus.isOpen ? '#58E08D' : '#FF5A5A',
                background: businessStatus.isOpen
                  ? 'rgba(88,224,141,0.08)'
                  : 'rgba(255,90,90,0.08)',
                border: businessStatus.isOpen
                  ? '1px solid rgba(88,224,141,0.24)'
                  : '1px solid rgba(255,90,90,0.24)',
                padding: '10px 16px',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '1rem',
                animation: 'pulse 1.8s infinite',
                marginBottom: '26px',
                zIndex: 1,
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>●</span>
              {businessStatus.isOpen ? 'Open Now' : 'Closed'}
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  opacity: 0.82,
                  letterSpacing: '0.04em',
                }}
              >
                {businessStatusDebugText}
              </span>
            </div>

            <div
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(2.3rem, 4vw, 3.6rem)',
                fontWeight: 800,
                textAlign: 'center',
                lineHeight: 1.05,
                color: '#FFFFFF',
                zIndex: 1,
                textShadow: '0 0 30px rgba(255,255,255,0.06)',
              }}
            >
              Oxford
              <br />
              Barber
            </div>

            <div
              style={{
                marginTop: '18px',
                color: '#C6A15B',
                fontWeight: 600,
                fontSize: '1.05rem',
                letterSpacing: '0.5px',
                zIndex: 1,
              }}
            >
              Darlinghurst, NSW 2010
            </div>

            <div
              style={{
                marginTop: '12px',
                color: '#8D8D8D',
                fontSize: '0.95rem',
                zIndex: 1,
              }}
            >
              Est. 2017 • Shop 5 113-115 Oxford Street
            </div>

            <div
              style={{
                marginTop: '34px',
                width: '240px',
                height: '240px',
                borderRadius: '50%',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'radial-gradient(circle, rgba(198,161,91,0.16) 0%, rgba(198,161,91,0.05) 42%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(198,161,91,0.24)',
                boxShadow:
                  '0 20px 50px rgba(0,0,0,0.45), inset 0 0 28px rgba(198,161,91,0.08)',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: '184px',
                  height: '184px',
                  borderRadius: '50%',
                  border: '2px solid rgba(198,161,91,0.26)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  background: 'rgba(10,10,10,0.82)',
                  backdropFilter: 'blur(6px)',
                  boxShadow: 'inset 0 0 20px rgba(255,255,255,0.02)',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    color: '#C6A15B',
                    fontSize: '0.82rem',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: '8px',
                  }}
                >
                  Est. 2017
                </div>

                <div
                  style={{
                    width: '52px',
                    height: '1px',
                    background: 'rgba(198,161,91,0.4)',
                    marginBottom: '14px',
                  }}
                ></div>

                <div
                  style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#FFFFFF',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    lineHeight: 1.1,
                    textTransform: 'uppercase',
                  }}
                >
                  Oxford
                  <br />
                  <span style={{ color: '#C6A15B' }}>Barber</span>
                </div>

                <div
                  style={{
                    width: '52px',
                    height: '1px',
                    background: 'rgba(198,161,91,0.4)',
                    marginTop: '14px',
                    marginBottom: '12px',
                  }}
                ></div>

                <div
                  style={{
                    color: '#A7A7A7',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                  }}
                >
                  Shop 5 113-115 Oxford Street
                  <br />
                  Darlinghurst NSW 2010
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        style={{
          background: '#0A0A0A',
          borderTop: '1px solid rgba(198,161,91,0.14)',
          borderBottom: '1px solid rgba(198,161,91,0.14)',
          overflow: 'hidden',
          padding: '16px 0',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '42px',
            whiteSpace: 'nowrap',
            animation: 'marquee 18s linear infinite',
            width: 'max-content',
          }}
        >
          {[
            'Beard Trim',
            'Buzz Cut',
            'Regular Hair Cut',
            'Zero Fade',
            'Skin Fade',
            'Scissor Cut',
            'Shop 5 113-115 Oxford Street Darlinghurst NSW 2010',
            'Beard Trim',
            'Buzz Cut',
            'Regular Hair Cut',
            'Zero Fade',
            'Skin Fade',
            'Scissor Cut',
            'Shop 5 113-115 Oxford Street Darlinghurst NSW 2010',
          ].map((item, index) => (
            <span
              key={`${item}-${index}`}
              style={{
                color: '#C6A15B',
                fontWeight: 700,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                paddingLeft: '20px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#C6A15B',
                  display: 'inline-block',
                }}
              ></span>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section
        className="home-section"
        id="services"
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '90px 48px 60px',
        }}
      >
        <div style={{ marginBottom: '34px' }}>
          <div
            style={{
              color: '#C6A15B',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontSize: '0.82rem',
              marginBottom: '14px',
            }}
          >
            What We Offer
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(2rem, 4vw, 3.4rem)',
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            Our <span style={{ color: '#C6A15B' }}>Services</span>
          </h2>
        </div>

        <div
          className="home-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '22px',
          }}
        >
          {SERVICES.map((s, index) => (
            <div
              key={s.id}
              onClick={() => handleBook(s)}
              style={{
                background:
                  'linear-gradient(180deg, rgba(20,20,20,0.96) 0%, rgba(12,12,12,0.98) 100%)',
                border: '1px solid rgba(198,161,91,0.12)',
                borderRadius: '22px',
                padding: '26px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 8px 26px rgba(0,0,0,0.24)',
                animation: `fadeUp ${0.55 + index * 0.08}s ease`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.borderColor = 'rgba(198,161,91,0.3)';
                e.currentTarget.style.boxShadow =
                  '0 20px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(198,161,91,0.08) inset';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(198,161,91,0.12)';
                e.currentTarget.style.boxShadow =
                  '0 8px 26px rgba(0,0,0,0.24)';
              }}
            >
              <div
                style={{
                  color: '#C6A15B',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  marginBottom: '14px',
                  letterSpacing: '2px',
                }}
              >
                {s.num}
              </div>

              <h3
                style={{
                  margin: '0 0 12px',
                  color: '#FFFFFF',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                }}
              >
                {s.name}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: '#A9A9A9',
                  lineHeight: 1.7,
                  minHeight: '58px',
                  fontSize: '0.98rem',
                }}
              >
                {s.desc}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '26px',
                }}
              >
                <div
                  style={{
                    color: '#C6A15B',
                    fontWeight: 800,
                    fontSize: '1.55rem',
                  }}
                >
                  ${s.price}
                </div>

                <div
                  style={{
                    color: '#D9D9D9',
                    background: 'rgba(198,161,91,0.08)',
                    border: '1px solid rgba(198,161,91,0.12)',
                    padding: '8px 12px',
                    borderRadius: '999px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                  }}
                >
                  {s.duration}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="home-section"
        id="about"
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '30px 48px 90px',
        }}
      >
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(18,18,18,0.95) 0%, rgba(10,10,10,0.98) 100%)',
            border: '1px solid rgba(198,161,91,0.12)',
            borderRadius: '28px',
            padding: '34px',
          }}
        >
          <div
            style={{
              color: '#C6A15B',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontSize: '0.82rem',
              marginBottom: '14px',
            }}
          >
            Why Choose Oxford Barber
          </div>

          <h2
            style={{
              margin: '0 0 26px',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            Premium service. <span style={{ color: '#C6A15B' }}>No shortcuts.</span>
          </h2>

          <div
            className="home-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px',
            }}
          >
            {[
              {
                title: 'Precision In Every Cut',
                text: 'Every appointment is handled carefully with clean finishing and attention to detail.',
              },
              {
                title: 'Simple Booking Request',
                text: 'Clients choose a service and request a time in a few simple steps.',
              },
              {
                title: 'Built For Real Clients',
                text: 'Fast, clear and professional. No clutter, no confusion, just booking that works.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(198,161,91,0.1)',
                  borderRadius: '20px',
                  padding: '22px',
                }}
              >
                <div
                  style={{
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    marginBottom: '10px',
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    color: '#A7A7A7',
                    lineHeight: 1.7,
                    fontSize: '0.96rem',
                  }}
                >
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section
          className="home-section"
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 48px 90px',
          }}
        >
          <div style={{ marginBottom: '30px' }}>
            <div
              style={{
                color: '#C6A15B',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                fontWeight: 700,
                fontSize: '0.82rem',
                marginBottom: '14px',
              }}
            >
              Client Reviews
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 800,
                color: '#FFFFFF',
              }}
            >
              What Clients <span style={{ color: '#C6A15B' }}>Say</span>
            </h2>
          </div>

          <div
            className="home-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '22px',
            }}
          >
            {reviews.map((review, index) => (
              <div
                key={`${review.customerName}-${review.createdAt || index}`}
                style={{
                  background:
                    'linear-gradient(180deg, rgba(18,18,18,0.95) 0%, rgba(10,10,10,0.98) 100%)',
                  border: '1px solid rgba(198,161,91,0.12)',
                  borderRadius: '24px',
                  padding: '24px',
                }}
              >
                <div
                  style={{
                    color: '#C6A15B',
                    fontSize: '1rem',
                    letterSpacing: '3px',
                    marginBottom: '14px',
                  }}
                >
                  {'★'.repeat(Number(review.rating) || 0)}
                </div>

                <div
                  style={{
                    color: '#DADADA',
                    lineHeight: 1.8,
                    fontSize: '0.98rem',
                    marginBottom: '18px',
                  }}
                >
                  "{review.text}"
                </div>

                <div
                  style={{
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  {review.customerName}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {galleryItems.length > 0 && (
        <section
          className="home-section"
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '0 48px 90px',
          }}
        >
          <div style={{ marginBottom: '30px' }}>
            <div
              style={{
                color: '#C6A15B',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                fontWeight: 700,
                fontSize: '0.82rem',
                marginBottom: '14px',
              }}
            >
              Gallery
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 800,
                color: '#FFFFFF',
              }}
            >
              Recent <span style={{ color: '#C6A15B' }}>Work</span>
            </h2>
          </div>

          <div
            className="home-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '22px',
            }}
          >
            {galleryItems.map((item, index) => (
              <div
                key={`${item.imageUrl}-${item.createdAt || index}`}
                style={{
                  background:
                    'linear-gradient(180deg, rgba(18,18,18,0.95) 0%, rgba(10,10,10,0.98) 100%)',
                  border: '1px solid rgba(198,161,91,0.12)',
                  borderRadius: '24px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '320px',
                    background: '#121212',
                  }}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title || 'Oxford Barber gallery'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>

                <div style={{ padding: '18px 20px' }}>
                  <div
                    style={{
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    {item.title || 'Oxford Barber'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <a
        href="https://wa.me/61432271141"
        aria-label="WhatsApp +61 432 271 141"
        title="+61 432 271 141"
        target="_blank"
        rel="noreferrer"
        style={{
          position: 'fixed',
          right: '26px',
          bottom: '26px',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: '#25D366',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          boxShadow: '0 10px 26px rgba(37,211,102,0.34)',
          zIndex: 120,
          transition: 'transform 0.25s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

      {showAdminModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="home-modal"
            style={{
              width: '100%',
              maxWidth: '420px',
              background:
                'linear-gradient(180deg, rgba(18,18,18,0.98) 0%, rgba(10,10,10,1) 100%)',
              border: '1px solid rgba(198,161,91,0.18)',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: '1.5rem',
                fontWeight: 800,
                marginBottom: '8px',
              }}
            >
              Admin Access
            </div>

            <div
              style={{
                color: '#A8A8A8',
                marginBottom: '20px',
                lineHeight: 1.6,
              }}
            >
              Enter the admin password to continue.
            </div>

            {adminError && (
              <div
                style={{
                  background: 'rgba(255,90,90,0.08)',
                  border: '1px solid rgba(255,90,90,0.2)',
                  color: '#FF9B9B',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                  fontWeight: 600,
                }}
              >
                {adminError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} style={{ display: 'grid', gap: '16px' }}>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  background: '#121212',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '16px',
                  padding: '15px 16px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  marginTop: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminPassword('');
                    setAdminError('');
                  }}
                  style={{
                    background: 'transparent',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '999px',
                    padding: '12px 18px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    background:
                      'linear-gradient(135deg, #D4AF37 0%, #C6A15B 55%, #B88B2A 100%)',
                    color: '#0B0B0B',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '12px 18px',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  Enter Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
