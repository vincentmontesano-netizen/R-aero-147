/** One item per zone and one zone per item, shared by click and drag input. */
export function placeVideoItem(previous:Record<string,string>,zoneId:string,itemId:string,zoneIds:string[],itemIds:string[]):Record<string,string>{
 if(!zoneIds.includes(zoneId)||!itemIds.includes(itemId))return previous;
 return Object.fromEntries([...Object.entries(previous).filter(([zone,item])=>zone!==zoneId&&item!==itemId),[zoneId,itemId]]);
}
