// A versão instalada do "archiver" (v8, reescrita em ESM) ainda não tem
// tipos publicados nem @types compatível — declaração solta (any) só pra
// destravar o import; a API real (append/file/pipe/finalize) é usada como
// documentada no pacote.
declare module 'archiver';
