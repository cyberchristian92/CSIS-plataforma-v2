import { marked } from "marked";
import DOMPurify from "dompurify";

// CommonMark completo via `marked` (o parser anterior era hand-rolled e não
// cobria tabelas, blocos de código, links, listas numeradas, blockquote —
// por isso "não funcionava 100%"). `DOMPurify` sanitiza antes de injetar via
// dangerouslySetInnerHTML, porque o conteúdo é fornecido pelo usuário.
marked.setOptions({ breaks: true, gfm: true });

// `[[Nome do Documento]]` vira um link interno de busca por título — os
// documentos não têm slug estável, então o alvo é resolvido em runtime pela
// página que consome o link (ver DocumentEditorPage), não aqui.
function resolveWikilinks(src: string): string {
  return src.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_match, alvo, _pipe, label) => {
    const texto = (label ?? alvo).trim();
    return `[${texto}](wikilink://${encodeURIComponent(alvo.trim())})`;
  });
}

export function markdownToHtml(src: string): string {
  const comLinks = resolveWikilinks(src);
  const html = marked.parse(comLinks, { async: false }) as string;
  return DOMPurify.sanitize(html);
}
