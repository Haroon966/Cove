import { useState } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Plug,
  Database,
  Palette,
  Search,
  Package,
  Monitor,
  FileCode,
  Download,
} from "../components/Icons";
import heroPlaceholder from "../assets/hero-placeholder.svg?url";

const BASE = import.meta.env.BASE_URL;

export default function HomePage() {
  const [heroImgSrc, setHeroImgSrc] = useState(`${BASE}herosection-images2.png`);

  const handleHeroImgError = () => {
    setHeroImgSrc(heroPlaceholder);
  };

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-nav-inner">
          <Link to="/" className="home-logo-link" aria-label="Cove home">
            <img src={`${BASE}cove-logo-color.png`} alt="" className="home-logo-img" width="40" height="40" />
            <span className="home-logo-text">Cove</span>
          </Link>
          <div className="home-nav-links">
            <a href="https://github.com/Haroon966/Cove/releases" target="_blank" rel="noopener noreferrer" className="home-nav-a home-nav-download">
              <Download size={18} strokeWidth={2} aria-hidden />
              <span>Download</span>
            </a>
            <a href="https://github.com/Haroon966/Cove" target="_blank" rel="noopener noreferrer" className="home-nav-a">
              GitHub
            </a>
            <Link to="/chat" className="home-nav-cta">
              Open Chat
            </Link>
          </div>
        </div>
      </nav>

      <header className="home-hero">
        <div
          className="home-hero-bg-image"
          style={{ backgroundImage: `url(${heroImgSrc})` }}
          aria-hidden="true"
        />
        <div className="home-hero-bg" aria-hidden="true" />
        <div className="home-hero-content">
          <div className="home-hero-text">
            <h1 className="home-hero-title">
              Your private corner for&nbsp;AI chat.
            </h1>
            <p className="home-hero-desc">
              Fully local, cross-platform. Talk to Ollama or any OpenAI-compatible API. Sessions live in SQLite on your machine—no CDN, no tracking.
            </p>
            <div className="home-hero-actions">
              <Link to="/chat" className="home-btn home-btn-primary">
                Start chatting
              </Link>
              <a href="https://github.com/Haroon966/Cove/releases" target="_blank" rel="noopener noreferrer" className="home-btn home-btn-secondary">
                <Download size={18} strokeWidth={2} aria-hidden />
                Download app
              </a>
              <a href="https://github.com/Haroon966/Cove#readme" target="_blank" rel="noopener noreferrer" className="home-btn home-btn-secondary">
                View docs
              </a>
            </div>
          </div>
        </div>
        <img
          src={heroImgSrc}
          alt=""
          className="home-hero-img-preload"
          onError={handleHeroImgError}
        />
      </header>

      <section className="home-features" aria-labelledby="features-heading">
        <h2 id="features-heading" className="home-section-title">What you get</h2>
        <div className="home-features-grid">
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden="true">
              <MessageCircle size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Streaming chat</h3>
            <p className="home-feature-desc">Tokens appear as they arrive. No waiting for the full response. In short: real-time replies.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden="true">
              <Plug size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Ollama & compatible</h3>
            <p className="home-feature-desc">Works with Ollama, LocalAI, LM Studio—configurable base URL and model. In short: use any OpenAI-compatible API.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden="true">
              <Database size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Sessions saved</h3>
            <p className="home-feature-desc">Conversations stored in SQLite. Resume anytime after restart. In short: your chats persist locally.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden="true">
              <Palette size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Theming</h3>
            <p className="home-feature-desc">Light, dark, or system; optional primary color to match your style. In short: make it yours.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden="true">
              <Search size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Search</h3>
            <p className="home-feature-desc">Find text across sessions and messages quickly. In short: Ctrl+K and search everywhere.</p>
          </article>
          <article className="home-feature-card">
            <div className="home-feature-icon-wrap" aria-hidden="true">
              <Package size={22} strokeWidth={2} />
            </div>
            <h3 className="home-feature-title">Cross-platform</h3>
            <p className="home-feature-desc">Windows (.exe), Ubuntu (.deb / AppImage), macOS (.dmg). In short: one app, every desktop.</p>
          </article>
        </div>
      </section>

      <section className="home-how" aria-labelledby="how-heading">
        <h2 id="how-heading" className="home-section-title">How it works</h2>
        <div className="home-how-grid">
          <div className="home-how-step">
            <span className="home-how-step-num" aria-hidden="true">1</span>
            <h3>Configure</h3>
            <p>Open Settings, set your base URL (e.g. <code>http://localhost:11434</code> for Ollama) and pick a model.</p>
          </div>
          <div className="home-how-step">
            <span className="home-how-step-num" aria-hidden="true">2</span>
            <h3>Chat</h3>
            <p>Start a new session. Messages stream in real time and are saved automatically so you can resume later.</p>
          </div>
          <div className="home-how-step">
            <span className="home-how-step-num" aria-hidden="true">3</span>
            <h3>Your data stays local</h3>
            <p>SQLite on your machine. No telemetry, no cloud. All requests go only to the API you configured.</p>
          </div>
        </div>
      </section>

      <section className="home-details" aria-labelledby="details-heading">
        <h2 id="details-heading" className="home-section-title">Details</h2>
        <div className="home-details-grid">
          <div className="home-detail-block">
            <div className="home-detail-icon-wrap" aria-hidden="true">
              <Monitor size={18} strokeWidth={2} />
            </div>
            <h3 className="home-detail-title">Run anywhere</h3>
            <ul>
              <li>Use it in the browser (no Rust) or as a desktop app.</li>
              <li>Same UI: configure base URL and model in Settings, then chat.</li>
            </ul>
          </div>
          <div className="home-detail-block">
            <div className="home-detail-icon-wrap" aria-hidden="true">
              <FileCode size={18} strokeWidth={2} />
            </div>
            <h3 className="home-detail-title">Data & config</h3>
            <ul>
              <li>Database: SQLite in the app data directory (e.g. <code>~/.local/share/app.cove/cove.db</code> on Linux).</li>
              <li>Config: <code>config.json</code> in the same directory.</li>
              <li>All requests go only to the base URL you set—no telemetry or external APIs.</li>
            </ul>
          </div>
          <div className="home-detail-block">
            <div className="home-detail-icon-wrap" aria-hidden="true">
              <Download size={18} strokeWidth={2} />
            </div>
            <h3 className="home-detail-title">Export & edit</h3>
            <ul>
              <li>Export conversations as Markdown or JSON.</li>
              <li>Edit and resend messages, regenerate from any point, copy replies with one click.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="home-cta-inner">
          <h2 className="home-cta-title">Ready to chat?</h2>
          <p className="home-cta-desc">Configure your API in Settings, then start a new conversation.</p>
          <Link to="/chat" className="home-btn home-btn-primary home-btn-large">
            Open Cove Chat
          </Link>
        </div>
      </section>

      <footer className="home-footer">
        <p className="home-footer-text">
          Cove is open source under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">GPL-3.0</a>. No tracking, no cloud—your data stays on your machine.
        </p>
      </footer>
    </div>
  );
}
