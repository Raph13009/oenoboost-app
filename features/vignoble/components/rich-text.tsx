// Renders an AOP long-text field (Couleurs & Cépages, Histoire, Sols, Climat).
//
// CMS-authored content may contain a small subset of formatting HTML produced
// by the rich-text editor (bold/italic/underline + lists/links):
//   <strong>/<b>, <em>/<i>, <u>, <br>, <p>, <ul>, <ol>, <li>, <a>
// Legacy values are plain text with line breaks. We detect whether the value
// contains HTML tags: if so we render it as HTML, otherwise we fall back to
// plain text with whitespace preserved so existing data keeps its line breaks.
//
// Content is authored by trusted admins via the (separate) CMS — same trust
// model as the blog article body — so it is injected as-is, without a runtime
// sanitizer.

const HTML_TAG_RE = /<\/?[a-z][^>]*>/i;

export function RichText({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  if (HTML_TAG_RE.test(value)) {
    return (
      <div
        className={`[&_a]:text-wine [&_a]:underline [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 ${className}`}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return <p className={`whitespace-pre-line ${className}`}>{value}</p>;
}
