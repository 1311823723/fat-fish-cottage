export type ArrivalEvent={tripId:string;place:string;at:number;souvenir:{id:string;label:string}|null};
export function arrivalCandidate(previous:any,next:any,now:number):ArrivalEvent|null;
export function arrivalPose(elapsed:number,entry:{x:number;y:number},desk:{x:number;y:number},idle:{x:number;y:number}):null|{x:number;y:number;action:string;phase:string;carrying:boolean};
