/** Bold **text** and `code` spans from catalog descriptions. */
export function RichDescription({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-medium text-foreground/80">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-muted/80 px-0.5 font-mono text-2xs">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </span>
  );
}
