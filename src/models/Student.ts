import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStudent extends Document {
    name: string;
    rfid_uid: string;
    rollNumber?: string;
    className?: string; // "10A", "10B"
    faceDescriptor?: number[];
    created_at: Date;
}

const StudentSchema: Schema = new Schema({
    name: { type: String, required: true },
    rfid_uid: { type: String, required: true, unique: true },
    rollNumber: { type: String },
    className: { type: String },
    faceDescriptor: { type: [Number], required: false },
    created_at: { type: Date, default: Date.now },
});

// Helper to avoid OverwriteModelError
const Student: Model<IStudent> = mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);

export default Student;
