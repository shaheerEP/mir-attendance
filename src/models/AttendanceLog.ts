import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAttendanceLog extends Document {
    student_id: mongoose.Types.ObjectId;
    timestamp: Date;
    status: string;
}

const AttendanceLogSchema: Schema = new Schema({
    student_id: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, default: 'PRESENT' },
});

const AttendanceLog: Model<IAttendanceLog> = mongoose.models.AttendanceLog || mongoose.model<IAttendanceLog>('AttendanceLog', AttendanceLogSchema);

export default AttendanceLog;
