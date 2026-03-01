import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  MessageCircle,
  Plug,
  Database,
  Palette,
  Search,
  Package,
  ChevronDown,
} from "../components/Icons";

const BASE = import.meta.env.BASE_URL;

const FAQ_ITEMS = [
  {
    q: "What is Cove?",
    a: "Cove is a local-first AI chat app. You run LLMs on your own machine (via Ollama or any OpenAI-compatible API), and all conversations are stored in SQLite on your device. No data is sent to the cloud.",
  },
  {
    q: "Do I need an API key?",
    a: "For Ollama or other self-hosted APIs, no. You just set a base URL (e.g. http://localhost:11434) and pick a model. If you use a cloud API that requires a key, you can add it in Settings.",
  },
  {
    q: "Where is my data stored?",
    a: "All chats and settings stay on your machine. The database is SQLite in your app data directory (e.g. ~/.local/share/app.cove/cove.db on Linux). Config is in config.json in the same folder.",
  },
  {
    q: "Can I use Ollama?",
    a: "Yes. Cove works natively with Ollama. Install Ollama, start it locally, then in Cove Settings set the base URL to http://localhost:11434 and choose your model.",
  },
  {
    q: "Is it open source?",
    a: "Yes. Cove is open source under GPL-3.0. The source code is on GitHub. No telemetry, no tracking—your data never leaves your control.",
  },
  {
    q: "How do I install?",
    a: "Download the installer for your OS from GitHub Releases (Windows .exe, macOS .dmg, Linux .deb or AppImage). Run it, then open Settings to set your API URL and model.",
  },
];

const TESTIMONIALS = [
  {
    name: "Alex Chen",
    role: "Developer",
    quote: "Finally, an AI chat that doesn’t send my code to the cloud. Cove with Ollama is exactly what I needed for local development.",
    initial: "A",
  },
  {
    name: "Sam Rivera",
    role: "Privacy advocate",
    quote: "Zero telemetry and SQLite on my machine. This is how AI tools should work. Clean UI and it just works.",
    initial: "S",
  },
  {
    name: "Jordan Lee",
    role: "Indie maker",
    quote: "I switched from cloud APIs to local models. Cove made it simple—one app, any compatible backend, and my data stays mine.",
    initial: "J",
  },
];

import { TRUSTED_LOGOS } from "../data/trustedLogos";

export default function HomePage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const [rainbowChar, setRainbowChar] = useState<number | null>(null);

  return (
    <div className="home home--light">
      {/* Sticky Navbar */}
      <nav className="home-nav home-nav--glass" aria-label="Main">
        <div className="home-nav-inner">
          <Link to="/" className="home-logo-link" aria-label="Cove home" onClick={scrollToTop}>
            <img src={`${BASE}cove-logo-color.png`} alt="" className="home-logo-img" width="32" height="32" />
            <span className="home-logo-text">Cove</span>
          </Link>
          <div className="home-nav-links home-nav-links--wide">
            <button type="button" className="home-nav-a" onClick={scrollToTop}>Home</button>
            <a href="#about" className="home-nav-a">About</a>
            <a href="#features" className="home-nav-a">Features</a>
            <a href="#pricing" className="home-nav-a">Pricing</a>
            <a href="#contact" className="home-nav-a">Contact</a>
          </div>
          <div className="home-nav-actions">
            <Link to="/chat" className="home-btn home-btn-ghost">Try online</Link>
            <a href="https://github.com/Haroon966/Cove/releases" target="_blank" rel="noopener noreferrer" className="home-btn home-btn-download">
              <Download size={18} strokeWidth={2} aria-hidden />
              Download
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="home-hero-saas" aria-labelledby="hero-heading">
        <div
          className="home-hero-saas-bg"
          style={{ backgroundImage: `url(${BASE}herosection-images1.png)` }}
          aria-hidden
        />
        <div className="home-hero-saas-inner">
          <div className="home-hero-saas-content">
            <h1 id="hero-heading" className="home-hero-saas-title">
              Your private corner for AI chat
            </h1>
          </div>
          <div className="home-hero-saas-mockup">
            <div className="home-hero-mockup-card">
              <div className="home-hero-badge home-hero-badge-on-mockup">
                <span className="home-hero-badge-dot" aria-hidden />
                100% local • No data leaves your machine
              </div>
              <img src={`${BASE}Cove-chat-page.png`} alt="Cove chat interface" className="home-hero-mockup-img" />
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="home-trusted" aria-labelledby="trusted-heading">
        <div className="home-trusted-carousel">
          <div className="home-trusted-track">
            {[...TRUSTED_LOGOS, ...TRUSTED_LOGOS].map((logo, i) => (
              <div key={i} className="home-trusted-logo" aria-hidden>
                <img
                  src={`${BASE}${logo.src}`}
                  alt={logo.alt}
                  className="home-trusted-logo-img"
                  width={80}
                  height={40}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="about" className="home-problem home-section" aria-labelledby="problem-heading">
        <div className="home-problem-grid">
          <div className="home-problem-image-wrap">
            <div className="home-problem-card">
              <img src={`${BASE}Cove-chat-page.png`} alt="Cove interface" className="home-problem-img" />
            </div>
          </div>
          <div className="home-problem-content">
            <h2 id="problem-heading" className="home-problem-title">Cloud AI puts your data at risk</h2>
            <ul className="home-problem-list">
              <li>Your prompts and responses can be logged or used for training</li>
              <li>Vendor lock-in and recurring API costs</li>
              <li>Latency and dependency on someone else’s servers</li>
            </ul>
            <p className="home-problem-desc">
              Cove runs models locally or on your own API. Your conversations stay in SQLite on your machine—no telemetry, no cloud. You stay in control.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="home-features home-section" aria-labelledby="features-heading">
        <h2 id="features-heading" className="home-section-title">Features</h2>
        <div className="home-features-grid">
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden>
              <MessageCircle size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Streaming chat</h3>
            <p className="home-feature-desc">Tokens appear as they arrive. Real-time replies, no waiting for the full response.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden>
              <Plug size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Ollama & compatible</h3>
            <p className="home-feature-desc">Works with Ollama, LocalAI, LM Studio. Any OpenAI-compatible API.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden>
              <Database size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Sessions saved</h3>
            <p className="home-feature-desc">Conversations in SQLite. Resume anytime. Your chats persist locally.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden>
              <Palette size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Theming</h3>
            <p className="home-feature-desc">Light, dark, or system. Optional primary color. Make it yours.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden>
              <Search size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Search</h3>
            <p className="home-feature-desc">Find text across sessions. Ctrl+K and search everywhere.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden>
              <Package size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Cross-platform</h3>
            <p className="home-feature-desc">Windows, Linux, macOS. One app, every desktop.</p>
          </article>
        </div>
      </section>

      {/* Testimonials */}
      <section className="home-testimonials home-section" aria-labelledby="testimonials-heading">
        <h2 id="testimonials-heading" className="home-section-title">What people say</h2>
        <div className="home-testimonials-grid">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="home-testimonial-card">
              <div className="home-testimonial-avatar" aria-hidden>{t.initial}</div>
              <div className="home-testimonial-stars" aria-hidden>
                ★★★★★
              </div>
              <p className="home-testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
              <p className="home-testimonial-name">{t.name}</p>
              <p className="home-testimonial-role">{t.role}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works (for "See how it works" anchor) */}
      <section id="how" className="home-how home-section" aria-labelledby="how-heading">
        <h2 id="how-heading" className="home-section-title">How it works</h2>
        <div className="home-how-grid">
          <div className="home-how-step">
            <span className="home-how-step-num" aria-hidden>1</span>
            <h3>Configure</h3>
            <p>Open Settings, set your base URL (e.g. <code>http://localhost:11434</code> for Ollama) and pick a model.</p>
          </div>
          <div className="home-how-step">
            <span className="home-how-step-num" aria-hidden>2</span>
            <h3>Chat</h3>
            <p>Start a new session. Messages stream in real time and are saved automatically.</p>
          </div>
          <div className="home-how-step">
            <span className="home-how-step-num" aria-hidden>3</span>
            <h3>Your data stays local</h3>
            <p>SQLite on your machine. No telemetry, no cloud. All requests go only to the API you configured.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="home-faq home-section" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="home-section-title">FAQ</h2>
        <div className="home-faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="home-faq-item">
              <button
                type="button"
                className={`home-faq-question ${faqOpen === i ? "home-faq-question--open" : ""}`}
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                aria-expanded={faqOpen === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
              >
                <span>{item.q}</span>
                <ChevronDown size={20} strokeWidth={2} aria-hidden />
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                className="home-faq-answer"
                hidden={faqOpen !== i}
              >
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section id="pricing" className="home-cta-final" aria-labelledby="cta-final-heading">
        <div className="home-cta-final-inner">
          <h2 id="cta-final-heading" className="home-cta-final-title">Ready to take control of your AI?</h2>
          <p className="home-cta-final-desc">Download Cove for free. No account required. Your data never leaves your machine.</p>
          <a href="https://github.com/Haroon966/Cove/releases" target="_blank" rel="noopener noreferrer" className="home-btn home-btn-primary home-btn-cta-final">
            <Download size={22} strokeWidth={2} aria-hidden />
            Download Cove
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="home-footer-saas" aria-label="Footer">
        <div className="home-footer-saas-inner">
          <div className="home-footer-brand" aria-label="Cove">
            {"COVE".split("").map((char, i) => (
              <span
                key={i}
                className={`home-footer-brand-char${rainbowChar === i ? " home-footer-brand-char--rainbow" : ""}`}
                onMouseEnter={() => setRainbowChar(i)}
                onMouseLeave={() => setRainbowChar(null)}
              >
                {char}
              </span>
            ))}
          </div>
          <div className="home-footer-inline">
            <span className="home-footer-label">Legal</span>
            <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" className="home-footer-link">License (GPL-3.0)</a>
            <span className="home-footer-sep" aria-hidden>·</span>
            <span className="home-footer-credit">
              Built with <span role="img" aria-label="heart">❤️</span> &amp; developed by{' '}
              <a
                href="https://github.com/Haroon966"
                className="home-footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Haroon Ali
              </a>
              .
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
