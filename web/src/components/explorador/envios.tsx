import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { enviarComProgresso, explorador, type ExplorerScope } from "@/lib/explorador";
import { cn, formatBytes } from "@/lib/utils";
import type { ItemParaEnviar } from "./arrastar";

const ENVIOS_SIMULTANEOS = 3;

interface Envio {
  id: number;
  nome: string;
  destino: string;
  tamanho: number;
  progresso: number;
  estado: "fila" | "enviando" | "ok" | "erro";
  erro?: string;
}

/// Fila de envios estilo Drive: vários arquivos (e pastas inteiras) de uma
/// vez, poucos em paralelo, com progresso por arquivo num painel no canto.
export function useEnvios(scope: ExplorerScope, aoConcluirArquivo: () => void) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [recolhido, setRecolhido] = useState(false);
  const proximoId = useRef(1);
  const cancelamentos = useRef(new Map<number, () => void>());

  const atualizar = (id: number, parcial: Partial<Envio>) =>
    setEnvios((lista) => lista.map((e) => (e.id === id ? { ...e, ...parcial } : e)));

  const enviar = useCallback(
    async (itens: ItemParaEnviar[], pastaAtualId?: string) => {
      if (itens.length === 0) return;
      const api = explorador(scope);
      setRecolhido(false);

      // Pastas da estrutura enviada: reaproveita pasta de mesmo nome já
      // existente no destino (não duplica "Fotos" a cada envio) e cria cada
      // uma uma única vez, mesmo com vários arquivos dentro dela.
      const pastaPorCaminho = new Map<string, Promise<string | undefined>>();
      pastaPorCaminho.set("", Promise.resolve(pastaAtualId));
      const garantirPasta = (partes: string[]): Promise<string | undefined> => {
        const chave = partes.join("/");
        const existente = pastaPorCaminho.get(chave);
        if (existente) return existente;
        const promessa = garantirPasta(partes.slice(0, -1)).then(async (paiId) => {
          const nome = partes[partes.length - 1];
          const irmas = await api.pastas(paiId);
          return irmas.find((p) => p.nome === nome)?.id ?? (await api.criarPasta(nome, paiId)).id;
        });
        pastaPorCaminho.set(chave, promessa);
        return promessa;
      };

      const novos: (Envio & { item: ItemParaEnviar })[] = itens.map((item) => ({
        id: proximoId.current++,
        nome: item.arquivo.name,
        destino: item.pastas.join(" / "),
        tamanho: item.arquivo.size,
        progresso: 0,
        estado: "fila",
        item,
      }));
      setEnvios((lista) => [...lista, ...novos.map(({ item: _item, ...e }) => e)]);

      const fila = [...novos];
      const trabalhador = async () => {
        for (let envio = fila.shift(); envio; envio = fila.shift()) {
          const { id, item } = envio;
          try {
            atualizar(id, { estado: "enviando" });
            const pastaId = await garantirPasta(item.pastas);
            const { promessa, cancelar } = enviarComProgresso(api.urlEnvio(pastaId), item.arquivo, (p) =>
              atualizar(id, { progresso: p }),
            );
            cancelamentos.current.set(id, cancelar);
            await promessa;
            atualizar(id, { estado: "ok", progresso: 1 });
            aoConcluirArquivo();
          } catch (erro) {
            atualizar(id, { estado: "erro", erro: erro instanceof Error ? erro.message : "Falha no envio." });
          } finally {
            cancelamentos.current.delete(id);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(ENVIOS_SIMULTANEOS, fila.length) }, trabalhador));
    },
    [scope, aoConcluirArquivo],
  );

  const emAndamento = envios.filter((e) => e.estado === "fila" || e.estado === "enviando").length;
  const concluidos = envios.filter((e) => e.estado === "ok").length;
  const falhas = envios.filter((e) => e.estado === "erro").length;

  const fechar = () => {
    cancelamentos.current.forEach((cancelar) => cancelar());
    setEnvios([]);
  };

  const painel =
    envios.length === 0 ? null : (
      <div className="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 bg-secondary/60 px-4 py-2.5">
          <p className="flex-1 text-sm font-medium">
            {emAndamento > 0
              ? `Enviando ${emAndamento} ${emAndamento === 1 ? "item" : "itens"}`
              : `${concluidos} ${concluidos === 1 ? "envio concluído" : "envios concluídos"}`}
            {falhas > 0 && <span className="text-destructive"> · {falhas} com erro</span>}
          </p>
          <button
            onClick={() => setRecolhido((v) => !v)}
            title={recolhido ? "Expandir" : "Recolher"}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            {recolhido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={fechar}
            title={emAndamento > 0 ? "Cancelar envios" : "Fechar"}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!recolhido && (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {envios.map((e) => (
              <li key={e.id} className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" title={e.nome}>
                      {e.nome}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.estado === "erro" ? e.erro : `${e.destino ? `${e.destino} · ` : ""}${formatBytes(e.tamanho)}`}
                    </p>
                  </div>
                  {e.estado === "ok" && <CheckCircle2 className="h-4 w-4 shrink-0 text-status-approved" />}
                  {e.estado === "erro" && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
                  {e.estado === "enviando" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
                </div>
                {(e.estado === "enviando" || e.estado === "fila") && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full bg-primary transition-[width]", e.estado === "fila" && "opacity-40")}
                      style={{ width: `${Math.round(e.progresso * 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );

  return { enviar, painel };
}
