import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStaffAttendanceLog extends Document {
    staff_id: mongoose.Types.ObjectId;
    timestamp: Date;
    status: string;
    deviceId?: string;
}

const StaffAttendanceLogSchema: Schema = new Schema({
    staff_id: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, default: 'PRESENT' },
    deviceId: { type: String },
});

const StaffAttendanceLog: Model<IStaffAttendanceLog> = mongoose.models.StaffAttendanceLog || mongoose.model<IStaffAttendanceLog>('StaffAttendanceLog', StaffAttendanceLogSchema);

export default StaffAttendanceLog;
