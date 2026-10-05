import React from 'react';
import DOMPurify from 'dompurify';

interface HtmlContentProps {
  html: string | null;
  className?: string;
}

/**
 * Renders HTML content safely using DOMPurify to prevent XSS.
 * Returns null when html prop is null or empty.
 */
const HtmlContent: React.FC<HtmlContentProps> = ({ html, className }) => {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
};

export default HtmlContent;
