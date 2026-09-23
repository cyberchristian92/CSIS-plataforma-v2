import type { CampoInscricao } from '@prisma/client';
import type { TipoCampo } from './dto/campo-inscricao.dto';

export interface RespostaRegistrada {
  campo_id: string;
  rotulo: string;
  tipo: string;
  valor: string | number | boolean | string[] | null;
}

const MAX_TEXTO = 2_000;
const MAX_TEXTO_LONGO = 10_000;

function vazio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    valor === false ||
    (typeof valor === 'string' && valor.trim() === '') ||
    (Array.isArray(valor) && valor.length === 0)
  );
}

/// Normaliza e valida uma resposta conforme o tipo do campo. Devolve o valor
/// que será guardado, ou uma mensagem de erro.
function validarValor(
  tipo: TipoCampo,
  campo: CampoInscricao,
  valor: unknown,
): { valor: RespostaRegistrada['valor'] } | { erro: string } {
  const texto = typeof valor === 'string' ? valor.trim() : null;
  switch (tipo) {
    case 'TEXTO':
    case 'TEXTO_LONGO': {
      const max = tipo === 'TEXTO' ? MAX_TEXTO : MAX_TEXTO_LONGO;
      if (texto === null) return { erro: 'deve ser um texto' };
      return texto.length > max
        ? { erro: `deve ter no máximo ${max} caracteres` }
        : { valor: texto };
    }
    case 'NUMERO': {
      const numero = typeof valor === 'number' ? valor : Number(texto ?? NaN);
      return Number.isFinite(numero)
        ? { valor: numero }
        : { erro: 'deve ser um número' };
    }
    case 'DATA':
      return texto &&
        /^\d{4}-\d{2}-\d{2}$/.test(texto) &&
        !Number.isNaN(Date.parse(texto))
        ? { valor: texto }
        : { erro: 'deve ser uma data (AAAA-MM-DD)' };
    case 'EMAIL':
      return texto &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto) &&
        texto.length <= 254
        ? { valor: texto.toLowerCase() }
        : { erro: 'deve ser um e-mail válido' };
    case 'TELEFONE':
      return texto && /\d/.test(texto) && texto.length <= 40
        ? { valor: texto }
        : { erro: 'deve ser um telefone' };
    case 'URL': {
      try {
        const url = new URL(texto ?? '');
        return url.protocol === 'http:' || url.protocol === 'https:'
          ? { valor: url.toString() }
          : { erro: 'deve ser um link http(s)' };
      } catch {
        return { erro: 'deve ser um link http(s)' };
      }
    }
    case 'SELECAO':
      return texto !== null && campo.opcoes.includes(texto)
        ? { valor: texto }
        : { erro: 'opção inválida' };
    case 'MULTIPLA':
      return Array.isArray(valor) &&
        valor.every((v) => typeof v === 'string' && campo.opcoes.includes(v))
        ? { valor: [...new Set(valor as string[])] }
        : { erro: 'opção inválida' };
    case 'ACEITE':
      return valor === true || valor === 'true'
        ? { valor: true }
        : { erro: 'precisa ser aceito' };
    case 'ARQUIVO':
      // Tratado à parte (vem como arquivo no multipart, não como resposta).
      return { valor: null };
  }
}

/// Confere as respostas contra o formulário vigente e devolve a cópia que
/// fica guardada na inscrição (rótulo e tipo inclusos, para a resposta
/// continuar legível mesmo se o campo for editado ou arquivado depois).
export function validarRespostas(
  campos: CampoInscricao[],
  respostas: Record<string, unknown>,
  nomesAnexos: Map<string, string>,
): { registradas: RespostaRegistrada[]; erros: string[] } {
  const registradas: RespostaRegistrada[] = [];
  const erros: string[] = [];

  for (const campo of campos) {
    const tipo = campo.tipo as TipoCampo;
    if (tipo === 'ARQUIVO') {
      const nome = nomesAnexos.get(campo.id) ?? null;
      if (!nome && campo.obrigatorio)
        erros.push(`"${campo.rotulo}" é obrigatório.`);
      registradas.push({
        campo_id: campo.id,
        rotulo: campo.rotulo,
        tipo,
        valor: nome,
      });
      continue;
    }

    const bruto = respostas[campo.id];
    if (vazio(bruto)) {
      if (campo.obrigatorio) {
        erros.push(
          tipo === 'ACEITE'
            ? `"${campo.rotulo}" precisa ser aceito.`
            : `"${campo.rotulo}" é obrigatório.`,
        );
      }
      registradas.push({
        campo_id: campo.id,
        rotulo: campo.rotulo,
        tipo,
        valor: null,
      });
      continue;
    }

    const resultado = validarValor(tipo, campo, bruto);
    if ('erro' in resultado) {
      erros.push(`"${campo.rotulo}" ${resultado.erro}.`);
    } else {
      registradas.push({
        campo_id: campo.id,
        rotulo: campo.rotulo,
        tipo,
        valor: resultado.valor,
      });
    }
  }
  return { registradas, erros };
}
