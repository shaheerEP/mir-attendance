import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPeriod {
    subject: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
}

export interface IDaySchedule {
    day: string;
    periods: IPeriod[];
}

export interface IClass extends Document {
    name: string;
    schedule: IDaySchedule[];
    created_at: Date;
}

const ClassSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    schedule: [{
        day: { type: String },
        periods: [{
            subject: { type: String },
            startTime: { type: String },
            endTime: { type: String }
        }]
    }],
    created_at: { type: Date, default: Date.now },
});

// Helper to avoid OverwriteModelError
const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>('Class', ClassSchema);

export default Class;
