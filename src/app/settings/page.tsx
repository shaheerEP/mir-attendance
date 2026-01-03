"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PeriodConfig {
    id: number;
    startTime: string;
    durationMinutes: number;
}

interface GracePeriodConfig {
    fullPresentMins: number;
    halfPresentMins: number;
}

interface SettingsData {
    periods: PeriodConfig[];
    gracePeriod: GracePeriodConfig;
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<SettingsData | null>(null);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    periods: data.periods,
                    gracePeriod: data.gracePeriod
                });
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handlePeriodChange = (index: number, field: keyof PeriodConfig, value: string | number) => {
        if (!settings) return;
        const newPeriods = [...settings.periods];
        newPeriods[index] = { ...newPeriods[index], [field]: value };
        setSettings({ ...settings, periods: newPeriods });
    };

    const handleGraceChange = (field: keyof GracePeriodConfig, value: number) => {
        if (!settings) return;
        setSettings({
            ...settings,
            gracePeriod: { ...settings.gracePeriod, [field]: value },
        });
    };

    const saveSettings = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                alert("Settings saved successfully!");
            } else {
                alert("Failed to save settings.");
            }
        } catch (error) {
            console.error(error);
            alert("Error saving settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h2>
                    <p className="text-muted-foreground">Configure class periods and attendance rules.</p>
                </div>
                <Button onClick={saveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Period Configuration */}
                <Card className="col-span-2 md:col-span-1">
                    <CardHeader>
                        <CardTitle>Class Periods</CardTitle>
                        <CardDescription>Set start times and duration for the 8 daily periods.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {settings?.periods.map((period, index) => (
                            <div key={period.id} className="grid grid-cols-6 gap-4 items-end">
                                <div className="col-span-1 flex items-center h-10 font-medium text-sm text-muted-foreground">
                                    P{period.id}
                                </div>
                                <div className="col-span-3 space-y-1">
                                    <Label className="text-xs">Start Time</Label>
                                    <Input
                                        type="time"
                                        value={period.startTime}
                                        onChange={(e) => handlePeriodChange(index, 'startTime', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <Label className="text-xs">Duration (m)</Label>
                                    <Input
                                        type="number"
                                        value={period.durationMinutes}
                                        onChange={(e) => handlePeriodChange(index, 'durationMinutes', parseInt(e.target.value))}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Grace Period & Rules */}
                <Card className="col-span-2 md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Attendance Rules</CardTitle>
                        <CardDescription>Define thresholds for Present and Half-Day.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Grace Period (Full Present)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={settings?.gracePeriod.fullPresentMins}
                                    onChange={(e) => handleGraceChange('fullPresentMins', parseInt(e.target.value))}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">minutes after start</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Students arriving within this time get full attendance.</p>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Half Day Limit</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={settings?.gracePeriod.halfPresentMins}
                                    onChange={(e) => handleGraceChange('halfPresentMins', parseInt(e.target.value))}
                                    className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">minutes after start</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Students arriving between Grace Period and this limit get Half Day.
                                <br />After this time, attendance is rejected (Late).
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
