export const objectiveMergeGroups = { definition:['code','title','description','knowledgeLevel'], placement:['moduleId'], required:['isRequired'], order:['sortOrder'] } as const;
export const slideMergeGroups = {
  title: ['title'], body: ['body'], image: ['imageUrl','imagePrompt'], audio: ['audioUrl'],
  video: ['videoUrl','videoCues'], placement: ['moduleId','objectiveId'],
  quiz: ['quizQuestion','quizOptions','quizCorrect','quizExplanation'],
} as const;
export type SlideMergeGroup = keyof typeof slideMergeGroups;
export const moduleMergeGroups = {
  title:['title'],description:['description'],content:['content'],video:['videoUrl'],pdf:['pdfUrl'],
  duration:['durationMinutes'],order:['sortOrder'],required:['isRequired'],
  quizPolicy:['quizPassingScore','quizMaxAttempts','quizTimeLimitMin'],
} as const;
export const questionMergeGroups = {
  assessment:['type','text','options','correct','explanation','points','optionsRight','keywords','legacyRegex','replaceLegacyRegex','pairs'],
  placement:['moduleId','objectiveId'],order:['sortOrder'],
} as const;
export function mergeSlideDraft<T extends Record<string,unknown>>(base:T,draft:T,latest:T,choices:Partial<Record<SlideMergeGroup,'draft'|'latest'>>={}) {
  return mergeDraftGroups(base,draft,latest,slideMergeGroups,choices);
}
export function mergeDraftGroups<T extends Record<string, unknown>>(base:T, draft:T, latest:T, groups:Record<string,readonly string[]>, choices:Partial<Record<string,'draft'|'latest'>>={}) {
  const merged={...draft};
  const conflicts:string[]=[];
  for(const group of Object.keys(groups)) {
    const keys=groups[group];
    const same=(a:T,b:T)=>keys.every(key=>JSON.stringify(a[key])===JSON.stringify(b[key]));
    let source=draft;
    if(same(draft,base))source=latest;
    else if(!same(latest,base)&&!same(draft,latest)) {
      if(!choices[group])conflicts.push(group);
      if(choices[group]==='latest')source=latest;
    }
    for(const key of keys)(merged as Record<string,unknown>)[key]=source[key];
  }
  return {merged,conflicts};
}
