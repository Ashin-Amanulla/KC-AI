import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

export function ChatMarkdown({ content, className }) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
    >
      <Markdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-0.5">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => <h3 className="mb-2 text-base font-semibold">{children}</h3>,
        h2: ({ children }) => <h4 className="mb-2 text-sm font-semibold">{children}</h4>,
        h3: ({ children }) => <h5 className="mb-1 text-sm font-semibold">{children}</h5>,
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-border" />,
        a: ({ href, children }) => (
          <a
            href={href}
            className="font-medium underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded-md bg-black/10 p-3 text-xs last:mb-0 dark:bg-black/30">
            {children}
          </pre>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className) || String(children).includes('\n');

          if (isBlock) {
            return (
              <code className={cn('font-mono', className)} {...props}>
                {children}
              </code>
            );
          }

          return (
            <code
              className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs dark:bg-black/30"
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
      >
        {content}
      </Markdown>
    </div>
  );
}
