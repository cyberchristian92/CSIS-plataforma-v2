import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2, Upload, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { usePromptDialog } from "@/components/ui/prompt-dialog";
import type { Lista } from "@/lib/types";

// White-label: nome e logo do Workspace ficam editáveis aqui, o que permite
// a mesma instância da CSIS ser reaproveitada por qualquer empresa (pedido
// explícito — não é só um ajuste cosmético, é o que torna a plataforma
// vendável como produto de prateleira, não só o sistema interno da CSIS).
export default function SettingsPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const { data: workspaces } = useQuery({ queryKey: ["workspaces"], queryFn: api.workspaces.listar });
  const workspace = workspaces?.[0];

  useEffect(() => {
    if (workspace) {
      setNome(workspace.nome);
      setLogoPreview(workspace.logo_data_url);
    }
  }, [workspace]);

  const salvar = useMutation({
    mutationFn: () => api.workspaces.atualizar(workspace!.id, { nome, logo_data_url: logoPreview }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["branding"] });
      setErro(null);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    },
    onError: (e: unknown) => setErro(e instanceof ApiError ? e.message : "Falha ao salvar."),
  });

  async function onSelecionarLogo(file: File) {
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setLogoPreview(dataUrl);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao processar a imagem.");
    }
  }

  if (!workspace) return null;

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Configurações</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Nome e identidade visual desta instância — aparecem na tela de login, na barra lateral e em todo o resto da
        plataforma.
      </p>

      <Card className="max-w-lg">
        <CardContent className="flex flex-col gap-5 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome da empresa</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Logo</label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <img src="/csis-mark.svg" alt="Logo padrão" className="h-full w-full object-contain p-1" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Enviar imagem
                </Button>
                {logoPreview && (
                  <button
                    onClick={() => setLogoPreview(null)}
                    className="text-left text-xs text-muted-foreground hover:text-destructive"
                  >
                    Voltar para a logo padrão
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onSelecionarLogo(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex items-center gap-3">
            <Button disabled={!nome.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
            {salvo && <span className="text-sm text-primary">Salvo.</span>}
          </div>
        </CardContent>
      </Card>

      <ListasDeAcesso workspaceId={workspace.id} />
    </div>
  );
}

// Grupos de nome livre usados pra restringir a visibilidade de um Projeto/
// Área/Pasta específico (ver ShareDialog) — quem cria e gerencia essas
// listas é sempre o Admin, mesma responsabilidade de "ajustar permissões"
// descrita no TCC.
function ListasDeAcesso({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const { ask, dialog: promptDialog } = usePromptDialog();
  const [expandida, setExpandida] = useState<string | null>(null);

  const { data: listas } = useQuery({ queryKey: ["listas", workspaceId], queryFn: () => api.listas.listarPorWorkspace(workspaceId) });
  const { data: usuarios } = useQuery({ queryKey: ["usuarios"], queryFn: api.auth.listarUsuarios });

  const criar = useMutation({
    mutationFn: async () => {
      const nome = await ask("Nome da lista");
      if (!nome) return Promise.reject(new Error("cancelado"));
      return api.listas.criar(workspaceId, nome);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listas", workspaceId] }),
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.listas.remover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listas", workspaceId] }),
  });

  const adicionarMembro = useMutation({
    mutationFn: ({ listaId, userId }: { listaId: string; userId: string }) => api.listas.adicionarMembro(listaId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listas", workspaceId] }),
  });

  const removerMembro = useMutation({
    mutationFn: ({ listaId, userId }: { listaId: string; userId: string }) => api.listas.removerMembro(listaId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listas", workspaceId] }),
  });

  return (
    <Card className="mt-4 max-w-lg">
      <CardContent className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-primary" /> Listas de Acesso
          </h2>
          <Button size="sm" variant="outline" onClick={() => criar.mutate()}>
            <Plus className="h-3.5 w-3.5" /> Nova lista
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Grupos de pessoas que você pode usar pra restringir quem acessa um Projeto, Área ou Pasta específico —
          gerencie os membros aqui, e escolha a lista no botão "Compartilhar" de cada recurso.
        </p>

        <div className="flex flex-col gap-2">
          {listas?.map((lista: Lista) => {
            const aberta = expandida === lista.id;
            const membroIds = new Set(lista.membros?.map((m) => m.user.id));
            return (
              <div key={lista.id} className="rounded-md border border-border">
                <button
                  onClick={() => setExpandida(aberta ? null : lista.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                >
                  <span className="font-medium">{lista.nome}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {lista.membros?.length ?? 0} membro(s)
                    {aberta ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {aberta && (
                  <div className="border-t border-border p-2">
                    {usuarios?.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={membroIds.has(u.id)}
                          onChange={(e) =>
                            e.target.checked
                              ? adicionarMembro.mutate({ listaId: lista.id, userId: u.id })
                              : removerMembro.mutate({ listaId: lista.id, userId: u.id })
                          }
                        />
                        <Avatar nome={u.nome} className="h-5 w-5 text-[9px]" />
                        {u.nome}
                      </label>
                    ))}
                    <button
                      onClick={() => remover.mutate(lista.id)}
                      className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir lista
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {(!listas || listas.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda.</p>
          )}
        </div>
      </CardContent>
      {promptDialog}
    </Card>
  );
}
