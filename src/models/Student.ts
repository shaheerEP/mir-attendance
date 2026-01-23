import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStudent extends Document {
    name: string;
    rollNumber?: string;
    className?: string; // "10A", "10B"
    faceDescriptor?: number[];
    imageId?: string;
    imageUrl?: string;
    created_at: Date;
}

const StudentSchema: Schema = new Schema({
    name: { type: String, required: true },
    rollNumber: { type: String },
    className: { type: String },
    faceDescriptor: { type: [Number], required: false },
    imageId: { type: String },
    imageUrl: { type: String },
    created_at: { type: Date, default: Date.now },
});

// Helper to avoid OverwriteModelError
const Student: Model<IStudent> = mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);

export default Student;
