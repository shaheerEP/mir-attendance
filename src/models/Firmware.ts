import mongoose, { Schema, Document } from "mongoose";

export interface IFirmware extends Document {
    version: string;
    data: Buffer;
    filename: string;
    contentType: string;
}

const FirmwareSchema = new Schema({
    version: { type: String, required: true, unique: true },
    data: { type: Buffer, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
}, { timestamps: true });

export default mongoose.models.Firmware || mongoose.model<IFirmware>("Firmware", FirmwareSchema);
