export type DepartureEvent={tripId:string;place:string;at:number};
export function departureCandidate(previous:any,next:any,now:number):DepartureEvent|null;
export function departurePose(elapsed:number,start:{x:number;y:number},bag:{x:number;y:number},exit:{x:number;y:number}):null|{x:number;y:number;action:string;phase:string;carrying:boolean;note:boolean};
