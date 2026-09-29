import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Peças de quadro no modelo do Trello, usadas pelo quadro do projeto e por
// Minhas Missões: listas recolhíveis e os "compositores" que criam card e
// lista ali mesmo, sem janela.

/// Listas recolhidas, lembradas no navegador por quadro (`chave`).
export function useListasRecolhidas(chave: string): [Set<string>, (id: string) => void] {
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(chave) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  function alternar(id: string) {
    setRecolhidas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      try {
        localStorage.setItem(chave, JSON.stringify([...nova]));
      } catch {
        // Sem armazenamento local: só não lembra.
      }
      return nova;
    });
  }
  return [recolhidas, alternar];
}

/// Lista recolhida: faixa estreita com o nome na vertical, como no Trello.
export function ListaRecolhida({
  titulo,
  total,
  onExpandir,
  destaque,
}: {
  titulo: string;
  total: number;
  onExpandir: () => void;
  destaque?: boolean;
}) {
  return (
    <button
      onClick={onExpandir}
      title={`Expandir "${titulo}"`}
      className={cn(
        "flex w-10 shrink-0 flex-col items-center gap-2 self-start rounded-xl bg-muted/60 px-1 py-3 text-sm font-semibold hover:bg-muted",
        destaque && "bg-amber-200/70 dark:bg-amber-500/20",
      )}
    >
      <span className="text-xs font-normal text-muted-foreground">{total}</span>
      <span className="[writing-mode:vertical-rl]">{titulo}</span>
    </button>
  );
}

/// "+ Adicionar um cartão": Enter cria e mantém aberto para o próximo; Esc fecha.
export function ComposerCartao({ onAdicionar }: { onAdicionar: (titulo: string) => Promise<unknown> }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  async function adicionar() {
    const texto = titulo.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    try {
      await onAdicionar(texto);
      setTitulo("");
      campo.current?.focus();
    } finally {
      setEnviando(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void adicionar();
    }
    if (e.key === "Escape") setAberto(false);
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Adicionar um cartão
      </button>
    );
  }
  return (
    <div className="mt-2">
      <textarea
        ref={campo}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Insira um título para este cartão…"
        rows={2}
        className="w-full resize-none rounded-lg border-0 bg-card px-2.5 py-2 text-sm shadow-[0_1px_1px_rgba(0,0,0,0.3)] ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="mt-1.5 flex items-center gap-1">
        <Button size="sm" onClick={() => void adicionar()} disabled={!titulo.trim() || enviando}>
          Adicionar cartão
        </Button>
        <button
          onClick={() => setAberto(false)}
          title="Cancelar"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/// "+ Adicionar outra lista", no fim do quadro.
export function ComposerLista({ onAdicionar }: { onAdicionar: (nome: string) => Promise<unknown> }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");

  async function adicionar() {
    const texto = nome.trim();
    if (!texto) return;
    await onAdicionar(texto);
    setNome("");
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex w-[272px] shrink-0 items-center gap-1.5 rounded-xl bg-muted/40 px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Adicionar outra lista
      </button>
    );
  }
  return (
    <div className="w-[272px] shrink-0 rounded-xl bg-muted/60 p-2">
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void adicionar();
          if (e.key === "Escape") setAberto(false);
        }}
        placeholder="Insira o nome da lista…"
        className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="mt-1.5 flex items-center gap-1">
        <Button size="sm" onClick={() => void adicionar()} disabled={!nome.trim()}>
          Adicionar lista
        </Button>
        <button
          onClick={() => setAberto(false)}
          title="Cancelar"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/// Título da lista editável no próprio cabeçalho (clique, digite, Enter).
export function TituloEditavel({
  valor,
  onSalvar,
  editavel,
}: {
  valor: string;
  onSalvar: (novo: string) => void;
  editavel: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);

  if (!editavel || !editando) {
    return (
      <span
        onClick={editavel ? () => setEditando(true) : undefined}
        className={cn("min-w-0 truncate text-sm font-semibold", editavel && "cursor-text")}
      >
        {valor}
      </span>
    );
  }
  function salvar() {
    setEditando(false);
    const novo = texto.trim();
    if (novo && novo !== valor) onSalvar(novo);
    else setTexto(valor);
  }
  return (
    <input
      autoFocus
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") salvar();
        if (e.key === "Escape") {
          setTexto(valor);
          setEditando(false);
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="h-7 min-w-0 flex-1 rounded border border-primary bg-card px-1.5 text-sm font-semibold focus:outline-none"
    />
  );
}
