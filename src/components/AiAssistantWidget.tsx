'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/lib/hooks/useChat';

export type AiAssistantRole = 'buyer' | 'seller' | 'admin';

interface AiAssistantWidgetProps {
  /** Which workspace this widget is mounted in — adjusts greeting, system framing and placeholder copy. */
  role: AiAssistantRole;
  /** Optional extra context appended to the system prompt, e.g. the current page or product being viewed. */
  context?: string;
}

type DisplayMessage = { role: 'user' | 'assistant'; content: string };

// All four providers have keys configured in this environment (see .env.local); Anthropic's
// haiku model is the fastest/cheapest of the allowed models in the chat-completion route, which
// suits a lightweight always-available widget best. Swap here if the operator prefers another
// ALLOWED_*_MODELS entry from src/app/api/ai/chat-completion/route.ts.
// OPEN_AI, not ANTHROPIC: the chat route resolves a provider key from
// ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / PERPLEXITY_API_KEY, and
// the production Worker only has OPENAI_API_KEY. Pointed at ANTHROPIC the route
// passed auth, quota, provider and model checks and then failed on the missing
// key with 503 "AI provider is not configured", which the widget surfaced as
// "Sorry, I couldn't get a response just now." Every message failed, and every
// failure still spent a day's quota.
//
// To run this on Claude instead, add ANTHROPIC_API_KEY to the Worker's secrets
// and set these back to ANTHROPIC / claude-3-5-haiku-latest.
const AI_PROVIDER = 'OPEN_AI';
const AI_MODEL = 'gpt-4o-mini';

// The API route caps a request at 20 messages / 20,000 characters total. Keeping a modest
// rolling window of prior turns (plus the new user message and one system message) stays
// comfortably inside both limits without truncating mid-conversation unexpectedly.
const MAX_HISTORY_MESSAGES = 10;

const ROLE_COPY: Record<
  AiAssistantRole,
  { title: string; subtitle: string; greeting: string; placeholder: string; systemPrompt: string }
> = {
  buyer: {
    title: 'FabricTrad Assistant',
    subtitle: 'Shopping & order help',
    greeting:
      "Hi! I can help you find fabrics, understand orders, or answer questions about shipping and returns. What do you need?",
    placeholder: 'Ask about products, orders, shipping…',
    systemPrompt:
      "You are the FabricTrad shopping assistant, embedded in a textile marketplace for buyers in India. Help buyers discover fabric products (type, GSM, width, MOQ), understand order status, payments, shipping and returns, and general marketplace usage. Keep answers short, concrete and friendly. You cannot look up this buyer's live order or account data — when asked about a specific order or shipment, direct them to the 'Your orders' or 'Track packages' tab, or 'Support & disputes' for issues. Never invent order numbers, tracking details, prices or seller names.",
  },
  seller: {
    title: 'Catalogue Assistant',
    subtitle: 'Listing & seller help',
    greeting:
      'Hi! I can help you write product titles and descriptions, structure MOQ pricing, or find your way around the seller dashboard. What are you working on?',
    placeholder: 'Ask about listings, pricing, catalogues…',
    systemPrompt:
      "You are the FabricTrad seller assistant, embedded in a textile marketplace seller dashboard. Help sellers write clear, compliant product titles and descriptions, structure variants (colour, design, GTIN), set MOQ-based pricing tiers, plan catalogues, and use seller dashboard tools (inventory, orders, fulfilment, payouts). Keep answers short, concrete and actionable. You cannot see this seller's live inventory, orders or payout data — for account-specific numbers, point them to the relevant dashboard tab (Products, Orders, Earnings & payouts). Never invent SKUs, order numbers or amounts.",
  },
  admin: {
    title: 'Admin Assistant',
    subtitle: 'Internal operations help',
    greeting:
      "Hi! I can help with platform operations questions, dispute-triage guidance, or finding your way around the admin portal. What's up?",
    placeholder: 'Ask about operations, policy, navigation…',
    systemPrompt:
      'You are an internal assistant for FabricTrad platform administrators, embedded in the admin portal of a textile marketplace. Help staff with operational questions: order and dispute triage guidance, reconciliation and payments concepts, seller verification policy, and navigating admin portal tools. Keep answers short and concrete. You cannot see live platform data (orders, sellers, payments) — for account-specific or numeric answers, point the admin to the relevant portal tab. Never invent figures, order IDs or user data.',
  },
};

export default function AiAssistantWidget({ role, context }: AiAssistantWidgetProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const copy = ROLE_COPY[role];

  // Both pieces this component renders are `position: fixed`, but it is mounted
  // inside the routed page — which RouteExperienceEnhancer wraps in
  // .ft-route-content and animates with `transform` on every navigation. A
  // transformed ancestor becomes the containing block for fixed descendants, so
  // for the 420ms the entrance animation runs the launcher anchors to that
  // wrapper's full scroll height instead of the viewport. On a long page that
  // throws it clean off screen: measured at top 3568px on a 780px viewport on
  // /help, which is what the mobile layout audit has been failing on.
  //
  // The keyframes already end on `transform: none` and the class is stripped on
  // animationend, so the trap was never permanent — but it cannot be closed from
  // the CSS side while a transform-based page transition exists at all. Escaping
  // the wrapper entirely is the actual fix. document.body is the host rather
  // than a dedicated node because `.ft-root` lives on <body>, so panel styling
  // that selects `html .ft-root .ft-ai-widget-panel` keeps matching, as do the
  // `body:has(.ft-ai-widget-fab)` collision rules.
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  // The signed-out sign-in link wants the current query string too, but
  // useSearchParams() would force every page mounting this widget to sit
  // behind a Suspense boundary (otherwise Next fails the build for the
  // statically-rendered ones, e.g. /help and /cart). Reading location.search
  // after mount gets the same value without that constraint, and this is only
  // ever used in the client-rendered signed-out branch.
  const [search, setSearch] = useState('');
  useEffect(() => setSearch(window.location.search), [pathname]);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([{ role: 'assistant', content: copy.greeting }]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { response, isLoading, error, sendMessage } = useChat(AI_PROVIDER, AI_MODEL, true);

  const systemPrompt = useMemo(
    () => (context ? `${copy.systemPrompt}\n\nCurrent context: ${context}` : copy.systemPrompt),
    [copy.systemPrompt, context]
  );

  // The hook resets `response` to '' at the start of every sendMessage call and streams into it
  // chunk by chunk; there is no "final message" callback exposed, so we watch isLoading's
  // trailing edge (true -> false) to know a request has settled, then fold whatever landed in
  // `response` (or a fallback on error) into our own display history exactly once.
  useEffect(() => {
    if (!pending || isLoading) return;
    if (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't get a response just now. Please try again in a moment." },
      ]);
    } else if (response) {
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    }
    setPending(false);
    // Only re-run when the loading edge changes; response/error/pending are read, not depended
    // on, so a mid-stream update to `response` doesn't retrigger this settlement effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, response, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Don't flash the signed-out prompt while the session is still being restored.
  if (loading || !portalHost) return null;

  // The chat-completion route requires an authenticated Supabase session (401 otherwise) AND
  // burns a per-user daily quota (consume_api_quota with p_feature 'ai_chat'). Both of those
  // protections are keyed to a user id, so there is deliberately no anonymous chat path here:
  // an unauthenticated caller has no quota ceiling, which would make the endpoint a free,
  // unmetered LLM proxy. Signed-out visitors on public routes (help, cart) therefore get the
  // launcher plus a sign-in prompt — never an input box that would only 401 on submit.
  if (!user) {
    const next = `${pathname || '/'}${search}`;
    return createPortal(
      <>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ft-ai-widget-fab"
          aria-label={open ? `Close ${copy.title}` : `Open ${copy.title}`}
          aria-expanded={open}
        >
          <Icon name={open ? 'XMarkIcon' : 'SparklesIcon'} size={22} />
        </button>

        {open && (
          <section className="ft-ai-widget-panel ft-glass-card" role="dialog" aria-label={copy.title}>
            <header className="ft-ai-widget-header">
              <span className="ft-ai-widget-header-icon">
                <Icon name="SparklesIcon" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="ft-ai-widget-title">{copy.title}</p>
                <p className="ft-ai-widget-subtitle">Sign in to chat</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ft-ai-widget-close"
                aria-label="Close assistant"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            </header>

            <div className="ft-ai-widget-signedout">
              <p className="ft-ai-widget-signedout-copy">
                The FabricTrad assistant answers questions about fabrics, MOQ, pricing, shipping and
                returns. Sign in to your account to start a conversation.
              </p>
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="ft-ai-widget-signedout-cta">
                Sign in to continue
                <Icon name="ArrowRightIcon" size={15} />
              </Link>
            </div>
          </section>
        )}
      </>,
      portalHost,
    );
  }

  const handleSend = () => {
    const text = input.trim();
    if (!text || pending) return;

    const history = messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const payload = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: text },
    ];

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setPending(true);
    void sendMessage(payload);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ft-ai-widget-fab"
        aria-label={open ? `Close ${copy.title}` : `Open ${copy.title}`}
        aria-expanded={open}
      >
        <Icon name={open ? 'XMarkIcon' : 'SparklesIcon'} size={22} />
      </button>

      {open && (
        <section className="ft-ai-widget-panel ft-glass-card" role="dialog" aria-label={copy.title}>
          <header className="ft-ai-widget-header">
            <span className="ft-ai-widget-header-icon">
              <Icon name="SparklesIcon" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="ft-ai-widget-title">{copy.title}</p>
              <p className="ft-ai-widget-subtitle">{copy.subtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="ft-ai-widget-close" aria-label="Close assistant">
              <Icon name="XMarkIcon" size={16} />
            </button>
          </header>

          <div ref={scrollRef} className="ft-ai-widget-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={`ft-ai-widget-bubble-row ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                <div className="ft-ai-widget-bubble">{message.content}</div>
              </div>
            ))}
            {pending && (
              <div className="ft-ai-widget-bubble-row is-assistant">
                <div className="ft-ai-widget-bubble is-typing">
                  {response || (
                    <span className="ft-ai-widget-typing-dots" aria-label="Assistant is typing">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && !pending && <p className="ft-ai-widget-error">{error.message || 'Something went wrong. Please try again.'}</p>}

          <div className="ft-ai-widget-input-row">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={copy.placeholder}
              rows={1}
              className="ft-ai-widget-input"
              disabled={pending}
              aria-label="Message"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={pending || !input.trim()}
              className="ft-ai-widget-send"
              aria-label="Send message"
            >
              {pending ? <span className="ft-ai-widget-spinner" /> : <Icon name="PaperAirplaneIcon" size={16} />}
            </button>
          </div>
        </section>
      )}
    </>,
    portalHost,
  );
}
