import bidiFactory from 'bidi-js';
import path from 'node:path';
const bidi=bidiFactory();
const arabic=new RegExp('\\p{Script=Arabic}','u');
export const invoiceFontPath=path.resolve('assets/fonts/NotoSansArabic.ttf');

// Keep logical Arabic runs intact for Fontkit shaping; reorder runs, never letters.
export function invoiceVisualRuns(text:string, start=0, end=text.length-1) {
  const embedding=bidi.getEmbeddingLevels(text);
  const indices=Array.from({length:Math.max(0,end-start+1)},(_,i)=>start+i);
  for(const [a,b] of bidi.getReorderSegments(text,embedding,start,end)) {
    const reversed=indices.slice(a-start,b-start+1).reverse();
    indices.splice(a-start,reversed.length,...reversed);
  }
  const mirrored=new Map<number,string>();
  for(let i=start;i<=end;i++)if(embedding.levels[i]%2){const mirror=bidi.getMirroredCharacter(text[i]);if(mirror)mirrored.set(i,mirror);}
  const groups:number[][]=[];
  for(const index of indices) {
    const group=groups.at(-1), previous=group?.at(-1);
    const rtl=embedding.levels[index]%2===1;
    if(group&&previous!==undefined&&embedding.levels[previous]===embedding.levels[index]&&index===previous+(rtl?-1:1)) group.push(index);
    else groups.push([index]);
  }
  const runs=groups.map(group=>{
    const logical=[...group].sort((a,b)=>a-b).map(i=>mirrored.get(i)??text[i]).join('').replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'');
    // Neutral-only RTL runs have no Arabic script for Fontkit to detect.
    return embedding.levels[group[0]]%2&&!arabic.test(logical)?Array.from(logical).reverse().join(''):logical;
  });
  return {runs:runs.filter(Boolean),rtl:(embedding.paragraphs[0]?.level??0)%2===1};
}

export function invoiceText(doc:PDFKit.PDFDocument,text:string,width:number,size:number) {
  doc.font('Invoice').fontSize(size);
  const measure=(runs:string[])=>runs.reduce((n,run)=>n+doc.widthOfString(run,{features:[]}),0);
  const lines:Array<{runs:string[];rtl:boolean;width:number}>=[];
  for(const paragraph of text.split('\n')) {
    if(!paragraph){lines.push({runs:[],rtl:false,width:0});continue;}
    let start=0;
    while(start<paragraph.length) {
      let end=start, lastBreak=start;
      for(const segment of paragraph.slice(start).match(/\S+\s*|\s+/g)??[]) {
        const next=end+segment.length;
        if(measure(invoiceVisualRuns(paragraph,start,next-1).runs)>width) {
          if(end>start)break;
          for(const {segment:grapheme} of Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(segment))) {
            const nextGlyph=end+grapheme.length;
            if(measure(invoiceVisualRuns(paragraph,start,nextGlyph-1).runs)>width&&end>start)break;
            end=nextGlyph;
          }
          break;
        }
        end=next;lastBreak=end;
      }
      if(end<paragraph.length&&lastBreak>start)end=lastBreak;
      const trimmed=paragraph.slice(start,end).trimEnd();
      const line=invoiceVisualRuns(paragraph,start,start+trimmed.length-1);
      lines.push({...line,width:measure(line.runs)});
      start=end;
      while(paragraph[start]===' ')start++;
    }
  }
  const lineHeight=size*1.6;
  return {height:lines.length*lineHeight,lineHeight,lineCount:lines.length, draw(x:number,y:number,align?:'left'|'right'|'center',from=0,count=lines.length) {
    doc.font('Invoice').fontSize(size);
    lines.slice(from,from+count).forEach((line,index)=>{
      const alignment=align??(line.rtl?'right':'left');
      let left=x+(alignment==='right'?width-line.width:alignment==='center'?(width-line.width)/2:0);
      for(const run of line.runs) {
        doc.text(run,left,y+index*lineHeight,{lineBreak:false,features:[]});
        left+=doc.widthOfString(run,{features:[]});
      }
    });
  }};
}
