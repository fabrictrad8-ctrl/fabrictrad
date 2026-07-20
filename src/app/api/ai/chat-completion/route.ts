import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';

type Provider = 'OPEN_AI' | 'ANTHROPIC' | 'GEMINI' | 'PERPLEXITY';
type ChatMessage = { role?: string; content?: unknown };

const API_KEYS: Record<Provider, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  PERPLEXITY: process.env.PERPLEXITY_API_KEY,
};

const DEFAULT_MODELS: Record<Provider, string[]> = {
  OPEN_AI: ['gpt-4o-mini', 'gpt-4.1-mini'],
  ANTHROPIC: ['claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest'],
  GEMINI: ['gemini/gemini-2.0-flash', 'gemini/gemini-2.5-flash'],
  PERPLEXITY: ['sonar', 'sonar-pro'],
};

const isProvider = (value: unknown): value is Provider =>
  value === 'OPEN_AI' || value === 'ANTHROPIC' || value === 'GEMINI' || value === 'PERPLEXITY';

const getAllowedModels = (provider: Provider) => {
  const configured = process.env[`ALLOWED_${provider}_MODELS`]
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_MODELS[provider];
};

const messageSize = (message: ChatMessage) => {
  if (typeof message.content === 'string') return message.content.length;
  return JSON.stringify(message.content ?? '').length;
};

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 100_000) {
      return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { data: quotaAllowed, error: quotaError } = await supabase.rpc('consume_api_quota', {
      p_feature: 'ai_chat',
      p_daily_limit: Number(process.env.AI_CHAT_DAILY_LIMIT || 100),
    });
    if (quotaError) {
      console.error('AI quota check failed:', quotaError.message);
      return NextResponse.json({ error: 'AI service is temporarily unavailable.' }, { status: 503 });
    }
    if (!quotaAllowed) {
      return NextResponse.json({ error: 'Daily AI chat limit reached.' }, { status: 429 });
    }

    const body = (await request.json()) as {
      provider?: unknown;
      model?: unknown;
      messages?: unknown;
      stream?: unknown;
      parameters?: Record<string, unknown>;
    };

    if (!isProvider(body.provider)) {
      return NextResponse.json({ error: 'Unsupported AI provider.' }, { status: 400 });
    }
    if (typeof body.model !== 'string' || !getAllowedModels(body.provider).includes(body.model)) {
      return NextResponse.json({ error: 'Unsupported AI model.' }, { status: 400 });
    }
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 20) {
      return NextResponse.json({ error: 'Messages must contain between 1 and 20 entries.' }, { status: 400 });
    }

    const messages = body.messages as ChatMessage[];
    const totalCharacters = messages.reduce((total, message) => total + messageSize(message), 0);
    if (totalCharacters > 20_000) {
      return NextResponse.json({ error: 'Conversation is too large.' }, { status: 413 });
    }

    const apiKey = API_KEYS[body.provider];
    if (!apiKey) {
      return NextResponse.json({ error: 'AI provider is not configured.' }, { status: 503 });
    }

    const input = body.parameters || {};
    const parameters = {
      temperature:
        typeof input.temperature === 'number'
          ? Math.min(Math.max(input.temperature, 0), 2)
          : undefined,
      top_p:
        typeof input.top_p === 'number' ? Math.min(Math.max(input.top_p, 0), 1) : undefined,
      max_tokens:
        typeof input.max_tokens === 'number'
          ? Math.min(Math.max(Math.floor(input.max_tokens), 1), 2000)
          : 1000,
    };

    if (body.stream === true) {
      const response = await completion({
        model: body.model,
        messages,
        stream: true,
        api_key: apiKey,
        ...parameters,
      });
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));
            for await (const chunk of response as unknown as AsyncIterable<unknown>) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`)
              );
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          } catch (error) {
            console.error('AI streaming request failed:', error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', error: 'AI request failed.' })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store',
          Connection: 'keep-alive',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const response = await completion({
      model: body.model,
      messages,
      stream: false,
      api_key: apiKey,
      ...parameters,
    });
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('AI completion request failed:', error);
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 });
  }
}
