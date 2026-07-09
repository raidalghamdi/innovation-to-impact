/**
 * Minimal renderer for the Terms & Conditions body. The content is stored as
 * lightweight markdown (## headings + blank-line-separated paragraphs). We only
 * support the small subset the editor produces — no external markdown dependency.
 */
export function TermsContent({ content, dir }: { content: string; dir?: 'rtl' | 'ltr' }) {
  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="max-w-3xl space-y-4" dir={dir}>
      {blocks.map((block, i) => {
        const heading = block.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
          return (
            <h2 key={i} className="pt-2 text-lg font-semibold text-brand-teal">
              {heading[1]}
            </h2>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {block}
          </p>
        );
      })}
    </div>
  );
}
