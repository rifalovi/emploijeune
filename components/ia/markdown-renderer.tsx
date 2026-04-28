'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * Rendu Markdown premium pour les réponses de l'assistant IA — V2.0.1.
 *
 * Charte OIF :
 *   - Titres en bleu institutionnel (#0E4F88)
 *   - Code inline + blocks gris clair / gris très foncé
 *   - Blockquotes barrées en bleu OIF
 *   - Liens en cyan PS1, soulignés au hover
 *   - Tables propres avec en-têtes
 *
 * GitHub-flavored Markdown (remark-gfm) : tables, strikethrough, todo lists,
 * autolinks. Tout ce dont l'IA a besoin pour produire des notes
 * institutionnelles structurées.
 */
export function MarkdownRenderer({ children, dark = false }: { children: string; dark?: boolean }) {
  return (
    <div
      className={cn('text-sm leading-relaxed break-words', dark ? 'text-white' : 'text-slate-800')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={cn(
                'mt-4 mb-2 text-xl font-bold first:mt-0 md:text-2xl',
                dark ? 'text-white' : 'text-[#0E4F88]',
              )}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={cn(
                'mt-3 mb-1.5 text-lg font-semibold first:mt-0 md:text-xl',
                dark ? 'text-white' : 'text-[#0E4F88]',
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn(
                'mt-3 mb-1 text-base font-semibold first:mt-0',
                dark ? 'text-white' : 'text-slate-900',
              )}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className={cn('font-semibold', dark ? 'text-white' : 'text-slate-900')}>
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              // géré par <pre> → on retourne tel quel
              return <code className={className}>{children}</code>;
            }
            return (
              <code
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[0.85em]',
                  dark ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-800',
                )}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100 last:mb-0">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                'my-2 border-l-4 pl-3 italic',
                dark ? 'border-white/40 text-white/90' : 'border-[#0198E9] text-slate-600',
              )}
            >
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'underline-offset-2 hover:underline',
                dark ? 'text-white' : 'text-[#0198E9]',
              )}
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr
              className={cn('my-3 border-t', dark ? 'border-white/30' : 'border-slate-200')}
              aria-hidden
            />
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table
                className={cn(
                  'min-w-full border-collapse text-xs',
                  dark ? 'text-white' : 'text-slate-700',
                )}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={cn(dark ? 'bg-white/15' : 'bg-slate-100')}>{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-slate-300 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
