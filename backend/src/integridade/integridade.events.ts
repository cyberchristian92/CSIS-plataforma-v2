// Payloads dos eventos que disparam recálculo assíncrono de hash — ver
// IntegridadeService. `userId` viaja no evento pra que o registro de
// auditoria (`CID_ATUALIZADO`) aponte pra quem originou a mudança de
// conteúdo, mesmo o recálculo em si rodando fora do ciclo de vida da
// requisição HTTP original.
export const EVT_CONTEUDO_ALTERADO = 'integridade.conteudo-alterado';
// Reaproveitado tanto pra remoção de Arquivo/Documento quanto de Pasta — em
// ambos os casos o nó já não existe mais, só importa o escopo onde ele vivia.
export const EVT_CONTEUDO_REMOVIDO = 'integridade.conteudo-removido';
export const EVT_PASTA_ALTERADA = 'integridade.pasta-alterada';
export const EVT_HIERARQUIA_ALTERADA = 'integridade.hierarquia-alterada';

export interface ConteudoAlteradoEvent {
  tipo: 'arquivo' | 'documento';
  id: string;
  userId: string | null;
}

// O nó já não existe mais no banco quando este evento chega — carrega o
// escopo onde ele vivia pra a cascata poder subir a partir dali (não tem
// mais "o próprio nó" pra recalcular, só o pai que perdeu um filho).
export interface EscopoRemovidoEvent {
  escopo: {
    pasta_id: string | null;
    missao_id: string | null;
    projeto_id: string | null;
    area_id: string | null;
    workspace_id: string | null;
  };
  userId: string | null;
}

export interface PastaAlteradaEvent {
  id: string;
  userId: string | null;
}

export interface HierarquiaAlteradaEvent {
  tipo: 'missao' | 'projeto' | 'area';
  id: string;
  userId: string | null;
}
