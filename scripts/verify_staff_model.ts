import { spawn } from 'child_process';
import path from 'path';

async function testStaffAPI() {
    console.log("Starting Staff API Verification...");

    // We can't easily run Next.js API routes in isolation without starting the server.
    // However, we can use the models directly to verify DB interactions if we connect to DB.
    // Or we can try to use 'ts-node' to run a script that imports models.

    // Let's try to mock the API call logic using DB connection directly, 
    // effectively testing the logic inside the API route.

    const { default: dbConnect } = await import('../src/lib/db');
    const { default: Staff } = await import('../src/models/Staff');

    await dbConnect();
    console.log("Connected to DB");

    // 1. Create Staff
    const testId = `TEST-${Date.now()}`;
    console.log(`Creating staff with ID: ${testId}`);

    const newStaff = await Staff.create({
        name: "Test Staff",
        staffId: testId,
        department: "QA",
        designation: "Tester"
    });

    console.log("Staff Created:", newStaff._id);

    // 2. Fetch Staff
    const foundStaff = await Staff.findOne({ staffId: testId });
    if (foundStaff) {
        console.log("Staff Found:", foundStaff.name);
    } else {
        console.error("Staff NOT Found!");
    }

    // 3. Delete Staff
    await Staff.findByIdAndDelete(newStaff._id);
    console.log("Staff Deleted");

    process.exit(0);
}

testStaffAPI().catch(err => {
    console.error("Test Failed:", err);
    process.exit(1);
});
