import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStaff extends Document {
    name: string;
    staffId: string; // Employee ID
    department?: string;
    designation?: string;
    faceDescriptor?: number[];
    imageId?: string;
    imageUrl?: string;
    created_at: Date;
}

const StaffSchema: Schema = new Schema({
    name: { type: String, required: true },
    staffId: { type: String, required: true, unique: true },
    department: { type: String },
    designation: { type: String },
    faceDescriptor: { type: [Number], required: false },
    imageId: { type: String },
    imageUrl: { type: String },
    created_at: { type: Date, default: Date.now },
});

// Helper to avoid OverwriteModelError
const Staff: Model<IStaff> = mongoose.models.Staff || mongoose.model<IStaff>('Staff', StaffSchema);

export default Staff;
