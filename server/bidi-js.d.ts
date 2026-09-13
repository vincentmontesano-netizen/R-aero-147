declare module 'bidi-js' {
  type Levels = {levels: Uint8Array; paragraphs: Array<{start:number; end:number; level:number}>};
  export default function bidiFactory(): {
    getEmbeddingLevels(text:string, direction?:'ltr'|'rtl'): Levels;
    getReorderSegments(text:string, levels:Levels, start?:number, end?:number): Array<[number,number]>;
    getMirroredCharacter(text:string): string|null;
  };
}
