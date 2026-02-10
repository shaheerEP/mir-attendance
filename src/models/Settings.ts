import mongoose, { Schema, Document } from "mongoose";

export interface IPeriodConfig {
    id: number;
    startTime: string; // "HH:MM"
    durationMinutes: number;
}

export interface IGracePeriodConfig {
    fullPresentMins: number; // e.g., 5
    halfPresentMins: number; // e.g., 15 or calculated
}

export interface ISettings extends Document {
    periods: IPeriodConfig[];
    gracePeriod: IGracePeriodConfig;
    weeklyHolidays: number[]; // 0=Sun, 1=Mon...
}

export interface IDeviceConfig {
    wifiSSID?: string;
    wifiPassword?: string;
    firmwareVersion?: string;
    firmwareUrl?: string;
}

export interface ISettings extends Document {
    periods: IPeriodConfig[];
    gracePeriod: IGracePeriodConfig;
    weeklyHolidays: number[];
    deviceConfig: IDeviceConfig;
}

const PeriodSchema = new Schema<IPeriodConfig>({
    id: { type: Number, required: true },
    startTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
});

const SettingsSchema = new Schema<ISettings>(
    {
        periods: [PeriodSchema],
        gracePeriod: {
            fullPresentMins: { type: Number, default: 5 },
            halfPresentMins: { type: Number, default: 20 },
        },
        weeklyHolidays: { type: [Number], default: [5] }, // Default Friday (5)
        deviceConfig: {
            wifiSSID: { type: String, default: "" },
            wifiPassword: { type: String, default: "" },
            firmwareVersion: { type: String, default: "" },
            firmwareUrl: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

// Singleton-like behavior helper not strictly enforced by schema, 
// but we will stick to using the first document.
export default mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);
