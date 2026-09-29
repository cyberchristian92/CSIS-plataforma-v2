/// Emitido quando um cadastro passa a aguardar a decisão da equipe: no envio
/// (instância sem e-mail, ou identidade já verificada pelo Google) ou quando
/// a pessoa confirma o e-mail. Quem escuta avisa quem pode aprovar.
export const EVT_INSCRICAO_PENDENTE = 'inscricao.pendente';

export interface InscricaoPendente {
  userId: string;
}
