export type SignoffSnapshot={
 managerName:string|null;
 subjectName:string|null;
 trainingTitle:string|null;
 proof:null|{id:number;label:string|null;state:string;expiresAt:string|null;certificate:null|{id:number;number:string|null;status:string;expiresAt:string|null}};
};
