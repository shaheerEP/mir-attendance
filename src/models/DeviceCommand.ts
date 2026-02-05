import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDeviceCommand extends Document {
    command: string; // "ENROLL"
    payload: any;    // { studentId: "..." }
    status: string;  // "PENDING", "SENT", "COMPLETED"
    createdAt: Date;
    deviceId: string; // Target device (optional, for now just "esp32")
}

const DeviceCommandSchema: Schema = new Schema({
    command: { type: String, required: true },
    payload: { type: Object },
    status: { type: String, default: "PENDING" },
    createdAt: { type: Date, default: Date.now, expires: 300 }, // Auto-delete after 5 mins
    deviceId: { type: String, default: "default" }
});

const DeviceCommand: Model<IDeviceCommand> = mongoose.models.DeviceCommand || mongoose.model<IDeviceCommand>('DeviceCommand', DeviceCommandSchema);

export default DeviceCommand;
