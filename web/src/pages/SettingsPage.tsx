import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { resizeImageToDataUrl } from "@/lib/image-resize";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    </div>
  );
}
