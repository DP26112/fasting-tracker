// client/src/types.ts

export interface Note {
    id: string;     
    time: string;   
    text: string;
    fastHours: number; 
    dayOfMonth: number; 
}

// ⚠️ This line MUST have the 'export' keyword
export type FastType = 'wet' | 'dry';  

export interface FastRecord {
    _id: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    fastType: FastType;
    notes: Note[];
    dateLogged: string;
}