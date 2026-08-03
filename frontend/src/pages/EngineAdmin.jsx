import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  User,
  Wrench,
  XCircle,
} from 'lucide-react';
import { ChatMarkdown } from '../components/ChatMarkdown';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  applyEngineProposal,
  getEngineStatus,
  getErrorMessage,
  sendEngineChat,
} from '../api/engine';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi, I'm your Pay Rules Assistant. I can explain how wages, overtime, penalties, and allowances are calculated — and help you request changes in plain language.\n\nWhat would you like to know?",
};

const SUGGESTED_PROMPTS = [
  'How is overtime calculated?',
  'Explain Saturday and Sunday penalty rates',
  'What happens on public holidays?',
  'I need to change a pay rule',
];

function toApiMessages(messages) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => m.id !== 'welcome')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
}

function ProposalCard({ proposal, onApply, onDismiss, applying, applied, applyError }) {
  if (!proposal || applied) return null;

  return (
    <Card className="mt-3 border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1 min-w-0">
            <p className="font-medium text-sm">Proposed change</p>
            <p className="text-sm">{proposal.summary}</p>
            {proposal.impact && (
              <p className="text-2sm text-muted-foreground">{proposal.impact}</p>
            )}
          </div>
        </div>

        {applyError && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <XCircle className="size-3.5 shrink-0" />
            {applyError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onApply} disabled={applying}>
            {applying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Applying...
              </>
            ) : (
              'Apply this change'
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={applying}>
            Not now
          </Button>
        </div>
        <p className="text-2xs text-muted-foreground">
          I&apos;ll run safety checks before saving any change.
        </p>
      </CardContent>
    </Card>
  );
}

function AgentSteps({ steps }) {
  if (!steps?.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {steps.map((step, index) => (
        <Badge key={`${step.tool}-${index}`} variant="outline" className="gap-1">
          <Wrench className="size-3" />
          {step.label}
        </Badge>
      ))}
    </div>
  );
}

export default function EngineAdmin() {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    getEngineStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const result = await sendEngineChat(toApiMessages(nextMessages));
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          steps: result.steps || [],
          proposal: result.proposal || null,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: getErrorMessage(error),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleApply = async (message) => {
    if (!message.proposal?.code || applyingId) return;

    setApplyingId(message.id);
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, applyError: null } : m))
    );

    try {
      const result = await applyEngineProposal(message.proposal.code, {
        source: 'pay-rules-assistant',
        proposalId: message.proposal.id,
      });

      const refreshed = await getEngineStatus();
      setStatus(refreshed);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                proposal: null,
                applied: true,
                applyResult: result,
              }
            : m
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-applied-${Date.now()}`,
          role: 'assistant',
          content: `Done — the pay rules have been updated.\n\nNew version: ${result.version}\nSafety checks: ${result.testResults?.passedTests ?? 'all'} passed.`,
        },
      ]);
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, applyError: getErrorMessage(error) }
            : m
        )
      );
    } finally {
      setApplyingId(null);
    }
  };

  const dismissProposal = (messageId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposal: null } : m))
    );
  };

  const statusLabel = status?.ready
    ? 'Pay rules are up to date'
    : 'Pay rules are loading';

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col gap-4">
      <PageHeader
        title="Pay Rules Assistant"
        description="Ask questions or request pay rule changes in everyday language."
      >
        <Badge variant={status?.ready ? 'success' : 'warning'}>
          {status?.currentVersion ? `Version ${status.currentVersion}` : statusLabel}
        </Badge>
      </PageHeader>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const isUser = message.role === 'user';

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-primary text-primary-foreground'
                          : message.error
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted'
                      }`}
                    >
                      {isUser || message.error ? (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <ChatMarkdown content={message.content} />
                      )}
                    </div>

                    {!isUser && <AgentSteps steps={message.steps} />}

                    {!isUser && message.applied && (
                      <p className="text-2sm text-success flex items-center gap-1.5 px-1">
                        <CheckCircle2 className="size-3.5" />
                        Change applied successfully
                      </p>
                    )}

                    {!isUser && (
                      <ProposalCard
                        proposal={message.proposal}
                        applying={applyingId === message.id}
                        applied={message.applied}
                        applyError={message.applyError}
                        onApply={() => handleApply(message)}
                        onDismiss={() => dismissProposal(message.id)}
                      />
                    )}
                  </div>

                  {isUser && (
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </div>
                <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="border-t px-4 py-3 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          )}

          <form
            className="border-t p-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pay rules or describe a change you'd like..."
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
