import { Link } from "react-router-dom";
import {
  Download, MessageCircle, Plug, Database,
  Search, Package, Shield, Lock,
} from "../components/Icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const BASE = import.meta.env.BASE_URL;

const FEATURES = [
  { Icon: MessageCircle, title: "Streaming chat", desc: "Tokens appear as they arrive. Real-time replies, no waiting." },
  { Icon: Plug, title: "Any compatible API", desc: "Ollama, LocalAI, LM Studio, OpenAI, Groq. Any OpenAI-compatible endpoint." },
  { Icon: Database, title: "Local sessions", desc: "Conversations saved in SQLite on your device. Resume anytime." },
  { Icon: Lock, title: "Zero telemetry", desc: "No analytics, no tracking. Your data never leaves your machine." },
  { Icon: Search, title: "Search everywhere", desc: "Find messages across all sessions instantly. Ctrl+K shortcut." },
  { Icon: Package, title: "Cross-platform", desc: "Windows, Linux, macOS. One native app, every desktop." },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Configure", desc: "Open Settings and set your API URL (e.g. http://localhost:11434 for Ollama) and choose a model." },
  { step: "2", title: "Chat", desc: "Start a new session. Messages stream in real time and are saved automatically to SQLite." },
  { step: "3", title: "Stay private", desc: "All data stays local. No telemetry, no cloud. Every request goes only to the API you configured." },
];

const FAQ_ITEMS = [
  {
    q: "What is Cove?",
    a: "Cove is a local-first AI chat app. You run LLMs on your own machine via Ollama or any OpenAI-compatible API, and all conversations are stored in SQLite on your device. No data is sent to the cloud.",
  },
  {
    q: "Do I need an API key?",
    a: "For Ollama or other self-hosted APIs, no. Just set a base URL (e.g. http://localhost:11434) and pick a model. If you use a cloud API that requires a key, you can add it in Settings.",
  },
  {
    q: "Where is my data stored?",
    a: "All chats and settings stay on your machine. The database is SQLite in your app data directory (~/.local/share/app.cove/cove.db on Linux), including app config.",
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
    a: "Download the installer for your OS from GitHub Releases (Windows .exe, macOS .dmg, Linux .deb or AppImage). Run it, then open Settings to configure your API URL and model.",
  },
];

const TESTIMONIALS = [
  {
    name: "Alex Chen",
    role: "Developer",
    quote: "Finally, an AI chat that doesn't send my code to the cloud. Cove with Ollama is exactly what I needed.",
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
    quote: "I switched from cloud APIs to local models. Cove made it simple—one app, any compatible backend.",
    initial: "J",
  },
];

export default function HomePage() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-6 flex h-14 items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 transition-opacity"
            aria-label="Cove home"
            onClick={scrollToTop}
          >
            <img src={`${BASE}cove-logo-color.png`} alt="" width={28} height={28} className="rounded-sm" />
            <span>Cove</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground" aria-label="Page navigation">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/chat">Try online</Link>
            </Button>
            <Button size="sm" asChild>
              <a href="https://github.com/Haroon966/Cove/releases" target="_blank" rel="noopener noreferrer">
                <Download size={14} className="mr-1.5" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-20 text-center" aria-labelledby="hero-heading">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative max-w-4xl mx-auto px-6">
          <Badge variant="secondary" className="mb-6 text-xs px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 inline-block" />
            100% local · No data leaves your machine
          </Badge>
          <h1 id="hero-heading" className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Your private corner<br />
            <span className="text-primary">for AI chat</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Chat with local LLMs or any OpenAI-compatible API. All conversations stored privately on your device. Zero telemetry, zero cloud.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" className="h-11 px-6" asChild>
              <a href="https://github.com/Haroon966/Cove/releases" target="_blank" rel="noopener noreferrer">
                <Download size={18} className="mr-2" />
                Download free
              </a>
            </Button>
            <Button size="lg" variant="outline" className="h-11 px-6" asChild>
              <Link to="/chat">Try in browser</Link>
            </Button>
          </div>

          {/* App preview */}
          <div className="mt-16 relative">
            <div className="absolute -inset-0.5 bg-gradient-to-b from-primary/20 to-transparent rounded-xl opacity-60 blur-xl" aria-hidden />
            <div className="relative rounded-xl overflow-hidden border border-border shadow-2xl">
              <img
                src={`${BASE}Cove-chat-page.png`}
                alt="Cove chat interface screenshot"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30" aria-labelledby="features-heading">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 id="features-heading" className="text-3xl font-bold mb-3">Everything you need</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">A complete AI chat experience that keeps your data private by design.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ Icon, title, desc }) => (
              <Card key={title} className="border-border/60 hover:border-primary/40 transition-colors hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Icon size={18} className="text-primary" aria-hidden />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">{desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20" aria-labelledby="how-heading">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 id="how-heading" className="text-3xl font-bold mb-3">Get started in minutes</h2>
            <p className="text-muted-foreground">Three simple steps to privacy-first AI chat.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {step}
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy highlight */}
      <section className="py-20 bg-muted/30" aria-labelledby="privacy-heading">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield size={20} className="text-primary" />
              </div>
              <h2 id="privacy-heading" className="text-3xl font-bold mb-4">Privacy by design</h2>
              <ul className="space-y-3 text-muted-foreground">
                {[
                  "All chats stored locally in SQLite",
                  "No cloud sync, no telemetry",
                  "Works fully offline with local models",
                  "Open source under GPL-3.0",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden border border-border shadow-lg">
              <img
                src={`${BASE}Cove-chat-page.png`}
                alt="Cove interface"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20" aria-labelledby="testimonials-heading">
        <div className="max-w-5xl mx-auto px-6">
          <h2 id="testimonials-heading" className="text-3xl font-bold text-center mb-10">What people say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shrink-0">
                      {t.initial}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                  <div className="text-primary text-sm mb-2" aria-hidden>★★★★★</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">"{t.quote}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-muted/30" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto px-6">
          <h2 id="faq-heading" className="text-3xl font-bold text-center mb-10">Frequently asked</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4 data-[state=open]:bg-background">
                <AccordionTrigger className="text-left font-medium py-4 hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 text-center relative overflow-hidden" aria-labelledby="cta-heading">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 100%, hsl(var(--primary) / 0.12) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative max-w-2xl mx-auto px-6">
          <h2 id="cta-heading" className="text-4xl font-bold mb-4">Ready to take control?</h2>
          <p className="text-muted-foreground mb-8">
            Download Cove for free. No account required. Your data never leaves your machine.
          </p>
          <Button size="lg" className="h-12 px-8 text-base" asChild>
            <a href="https://github.com/Haroon966/Cove/releases" target="_blank" rel="noopener noreferrer">
              <Download size={18} className="mr-2" />
              Download Cove — it's free
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center" aria-label="Footer">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={`${BASE}cove-logo-color.png`} alt="" width={20} height={20} className="opacity-70" />
            <span className="font-semibold text-foreground">Cove</span>
          </div>
          <p>
            Built with ❤️ by{" "}
            <a href="https://github.com/Haroon966" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Haroon Ali
            </a>
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/Haroon966/Cove" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              GPL-3.0
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
