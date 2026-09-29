import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Sino do topo: o que está esperando uma ação da pessoa, com link direto.
// Só contagens (GET /notificacoes/resumo) — atualiza a cada minuto e ao
// voltar para a aba.
export function SinoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notificacoes-resumo"],
    queryFn: api.notificacoes.resumo,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const itens = [
    { n: data?.solicitacoes_cadastro ?? 0, texto: ["solicitação de cadastro", "solicitações de cadastro"], para: "/usuarios?aba=solicitacoes" },
    { n: data?.fila_revisao ?? 0, texto: ["entrega aguardando revisão", "entregas aguardando revisão"], para: "/fila-revisao" },
    { n: data?.missoes_devolvidas ?? 0, texto: ["missão devolvida para correção", "missões devolvidas para correção"], para: "/minhas-missoes" },
  ].filter((i) => i.n > 0);
  const total = itens.reduce((soma, i) => soma + i.n, 0);

  return (
    <div ref={caixa} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        title="Notificações"
        aria-label={total > 0 ? `Notificações: ${total} pendentes` : "Notificações"}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      {aberto && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-border bg-card p-1 shadow-lg">
          {itens.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Nada esperando por você agora.</p>
          ) : (
            itens.map((i) => (
              <Link
                key={i.para}
                to={i.para}
                onClick={() => setAberto(false)}
                className={cn("flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-accent")}
              >
                <span className="font-mono text-base font-semibold">{i.n}</span>
                <span>{i.texto[i.n === 1 ? 0 : 1]}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
