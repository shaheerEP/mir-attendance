require('dotenv').config({ path: '.env.local' });
// Polyfill for environment if needed, but for this script simple node run should be fine

async function checkDescriptors() {
    const dbConnect = (await import('../src/lib/db')).default;
    const Student = (await import('../src/models/Student')).default;

    await dbConnect();
    console.log("Checking students...");

    const students = await Student.find({});
    let errorCount = 0;

    for (const s of students) {
        if (!s.faceDescriptor) {
            console.log(`Student ${s.name} (${s._id}): No descriptor`);
            continue;
        }

        const len = s.faceDescriptor.length;
        if (len !== 128) {
            console.error(`ERROR: Student ${s.name} (${s._id}) has descriptor length ${len}! Expected 128.`);
            errorCount++;
        }
    }

    if (errorCount === 0) {
        console.log("All student descriptors have correct length (128).");
    } else {
        console.log(`Found ${errorCount} students with invalid descriptors.`);
    }

    process.exit(0);
}

checkDescriptors().catch(err => console.error(err));
