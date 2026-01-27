import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClass extends Document {
    name: string;
    created_at: Date;
}

const ClassSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    created_at: { type: Date, default: Date.now },
});

// Helper to avoid OverwriteModelError
const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>('Class', ClassSchema);

export default Class;
