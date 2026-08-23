import React from 'react';

const frameClass = 'relative h-[min(68dvh,720px)] min-h-[18rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-[1100px] sm:min-h-[1100px]';

const viewerStyles = `<style>
  html, body { width: 100% !important; max-width: 100% !important; min-height: 100% !important; margin: 0 !important; overflow-x: hidden !important; }
  body { overflow-y: auto !important; background: #eef2f6 !important; }
  .document-container { box-sizing: border-box !important; position: static !important; transform: none !important; width: calc(100% - 1rem) !important; max-width: 850px !important; min-width: 0 !important; height: auto !important; min-height: 1100px !important; margin: 0.5rem auto !important; overflow: visible !important; }
  img, svg, table { max-width: 100% !important; }
  table { width: 100% !important; table-layout: fixed !important; }
  th, td, p, li, span { overflow-wrap: anywhere; }
  @media (max-width: 639px) { .document-container { width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 1.25rem !important; box-shadow: none !important; } }
</style>`;

export const HtmlPagePreview: React.FC<{ html: string; title: string; className?: string }> = ({ html, title, className = '' }) => {
  const srcDoc = html.includes('</head>') ? html.replace(/<\/head>/i, `${viewerStyles}</head>`) : `${viewerStyles}${html}`;
  return <div className={`${frameClass} ${className}`}><iframe title={title} sandbox="" srcDoc={srcDoc} className="h-full w-full border-0 bg-white" /></div>;
};

export const PdfPagePreview: React.FC<{ url: string; title: string }> = ({ url, title }) => (
  <div className={frameClass}>
    <iframe title={title} src={`${url}#zoom=page-fit`} className="h-full w-full border-0 bg-white" />
  </div>
);
