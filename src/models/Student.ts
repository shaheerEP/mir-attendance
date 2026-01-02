import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStudent extends Document {
    name: string;
    rfid_uid: string;
    created_at: Date;
}

const StudentSchema: Schema = new Schema({
    name: { type: String, required: true },
    rfid_uid: { type: String, required: true, unique: true },
    created_at: { type: Date, default: Date.now },
});

// Helper to avoid OverwriteModelError
const Student: Model<IStudent> = mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);

export default Student;
