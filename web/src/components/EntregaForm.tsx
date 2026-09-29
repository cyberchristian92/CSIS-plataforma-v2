import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, X } from "lucide-react";
import { Button } from "./ui/button";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

interface Falha {
  file: File;
  erro: string;
}

// Entrega = descrição + arquivos (laudo, evidências). O servidor registra a
// entrega primeiro e só aceita anexos do autor enquanto ela aguarda revisão,
// então os arquivos sobem depois, um por vez, com o hash SHA-256 calculado lá.
// Se algum falhar, a entrega já existe: o formulário fica aberto só com os que
// faltaram, para tentar de novo sem criar outra entrega.
export function EntregaForm({
  missaoId,
  projetoId,
  onEntregue,
  onCancelar,
}: {
  missaoId: string;
  projetoId: string;
  /// Recebe o id da entrega registrada (para encadear, ex.: autoaprovação).
  onEntregue: (entregaId: string) => void;
  onCancelar: () => void;
}) {
  const qc = useQueryClient();
  const inputArquivos = useRef<HTMLInputElement>(null);
  const [conteudo, setConteudo] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [entregaId, setEntregaId] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<Falha[]>([]);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const reenviando = entregaId !== null;

  function atualizarTelas() {
    for (const chave of [["missao", missaoId], ["entregas", missaoId], ["missoes-minhas"], ["missoes-em-revisao"], ["missoes", projetoId]]) {
      qc.invalidateQueries({ queryKey: chave });
    }
  }

  async function subir(id: string, lista: File[]): Promise<Falha[]> {
    const novasFalhas: Falha[] = [];
    for (const [i, file] of lista.entries()) {
      setProgresso(`Enviando ${i + 1} de ${lista.length}: ${file.name}`);
      try {
        await api.arquivos.enviarNaEntrega(projetoId, missaoId, id, file);
      } catch (e) {
        novasFalhas.push({ file, erro: e instanceof Error ? e.message : "falha no envio" });
      }
    }
    setProgresso(null);
    return novasFalhas;
  }

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      let id = entregaId;
      if (!id) {
        id = (await api.entregas.criar(missaoId, conteudo.trim() || undefined)).id;
        setEntregaId(id);
      }
      const restantes = await subir(id, reenviando ? falhas.map((f) => f.file) : arquivos);
      atualizarTelas();
      setFalhas(restantes);
      if (restantes.length === 0) onEntregue(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a entrega.");
    } finally {
      setEnviando(false);
    }
  }

  if (reenviando) {
    return (
      <div className="flex flex-col gap-2 border-l-2 border-destructive pl-3 text-sm">
        <p>
          A entrega foi registrada, mas {falhas.length === 1 ? "1 arquivo não foi enviado" : `${falhas.length} arquivos não foram enviados`}:
        </p>
        <ul className="text-xs text-muted-foreground">
          {falhas.map((f) => (
            <li key={f.file.name}>
              {f.file.name} — {f.erro}
            </li>
          ))}
        </ul>
        {progresso && <p className="text-xs text-muted-foreground">{progresso}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={enviar} disabled={enviando}>
            Tentar enviar de novo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEntregue(entregaId!)} disabled={enviando}>
            Seguir sem eles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        placeholder="O que está sendo entregue: resultado, ferramentas usadas, observações para o revisor…"
        className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      {arquivos.length > 0 && (
        <ul className="divide-y divide-border border-y border-border text-sm">
          {arquivos.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                {formatBytes(f.size)}
                <button
                  type="button"
                  onClick={() => setArquivos((atual) => atual.filter((_, j) => j !== i))}
                  className="hover:text-foreground"
                  title="Tirar da entrega"
                  disabled={enviando}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputArquivos}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const novos = Array.from(e.target.files ?? []);
          setArquivos((atual) => [...atual, ...novos]);
          e.target.value = "";
        }}
      />

      {erro && <p className="border-l-2 border-destructive pl-3 text-xs text-destructive">{erro}</p>}
      {progresso && <p className="text-xs text-muted-foreground">{progresso}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => inputArquivos.current?.click()} disabled={enviando}>
          <Paperclip className="h-3.5 w-3.5" /> Anexar arquivos
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar para revisão"}
          </Button>
        </div>
      </div>
    </div>
  );
}
