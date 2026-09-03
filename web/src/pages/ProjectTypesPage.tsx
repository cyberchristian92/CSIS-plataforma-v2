// O backend já tem o modelo TipoProjeto/TipoMissao/CampoCustomizado no
// schema.prisma (Campos Customizados, ver Especificação Técnica), mas ainda
// não existe controller/endpoint para essas rotas — não implementado ainda.
export default function ProjectTypesPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Tipos de Projeto</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        O modelo de dados de Campos Customizados (TipoProjeto/TipoMissao/CampoCustomizado) já existe no
        backend, mas ainda não há endpoints de API para esta tela. Fica como próximo passo de
        implementação.
      </p>
    </div>
  );
}
