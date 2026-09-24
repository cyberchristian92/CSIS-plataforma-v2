/// Um arquivo a enviar e as pastas (a partir da pasta atual) onde ele deve
/// ficar — ex.: arrastar "Caso/Fotos/img.jpg" dá pastas ["Caso", "Fotos"].
export interface ItemParaEnviar {
  arquivo: File;
  pastas: string[];
}

function lerArquivo(entrada: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entrada.file(resolve, reject));
}

/// readEntries devolve no máximo ~100 itens por chamada: repete até vir vazio.
async function lerDiretorio(entrada: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const leitor = entrada.createReader();
  const todas: FileSystemEntry[] = [];
  for (;;) {
    const lote = await new Promise<FileSystemEntry[]>((resolve, reject) => leitor.readEntries(resolve, reject));
    if (lote.length === 0) return todas;
    todas.push(...lote);
  }
}

async function percorrer(entrada: FileSystemEntry, pastas: string[], saida: ItemParaEnviar[]) {
  if (entrada.isFile) {
    saida.push({ arquivo: await lerArquivo(entrada as FileSystemFileEntry), pastas });
  } else if (entrada.isDirectory) {
    for (const filha of await lerDiretorio(entrada as FileSystemDirectoryEntry)) {
      await percorrer(filha, [...pastas, entrada.name], saida);
    }
  }
}

/// Arquivos e pastas arrastados do computador (Finder/Explorer), com a
/// estrutura de pastas preservada.
export async function lerArrastados(dados: DataTransfer): Promise<ItemParaEnviar[]> {
  // As entradas precisam ser capturadas já — o DataTransfer esvazia depois
  // que o evento de drop termina.
  const entradas = [...dados.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry())
    .filter((e): e is FileSystemEntry => !!e);
  if (entradas.length === 0) return [...dados.files].map((arquivo) => ({ arquivo, pastas: [] }));
  const saida: ItemParaEnviar[] = [];
  for (const entrada of entradas) await percorrer(entrada, [], saida);
  return saida;
}

/// Arquivos escolhidos por <input webkitdirectory>: o caminho vem em
/// webkitRelativePath ("Caso/Fotos/img.jpg").
export function lerSelecaoDePasta(arquivos: FileList): ItemParaEnviar[] {
  return [...arquivos].map((arquivo) => {
    const partes = (arquivo.webkitRelativePath || arquivo.name).split("/");
    return { arquivo, pastas: partes.slice(0, -1) };
  });
}
