/// Cadastro público liga/desliga por instância (CADASTRO_ABERTO=false fecha).
export function cadastroAberto(): boolean {
  return process.env.CADASTRO_ABERTO !== 'false';
}
