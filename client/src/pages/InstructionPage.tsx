import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Marked } from "marked";
import instructionMarkdown from "../../../docs/instruction/instruction.md?raw";
import { Button } from "@/components/ui/button";

const imageUrls: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../../../docs/instruction/*.{jpg,jpeg,png,webp}", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.split("/").pop()!, url]),
);

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const marked = new Marked({
  renderer: {
    image({ href, text }) {
      const src = imageUrls[href] ?? href;
      return `<a href="${escapeAttr(src)}" target="_blank" rel="noopener"><img src="${escapeAttr(src)}" alt="${escapeAttr(text)}" loading="lazy" /></a>`;
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href);
      return `<a href="${escapeAttr(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
    },
  },
});

export function InstructionContent() {
  const html = useMemo(() => marked.parse(instructionMarkdown, { async: false }), []);

  return (
    <article className="instruction mx-auto max-w-3xl p-4 md:p-8" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function PublicInstructionPage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-label-primary">
            prismo
          </Link>
          <Button tag="instruction_header_home" variant="ghost" size="sm" icon="mdi:arrow-left" to="/">
            Home
          </Button>
        </nav>
      </header>
      <InstructionContent />
    </>
  );
}
