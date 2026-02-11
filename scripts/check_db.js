console.log('Script started');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env.local:', result.error);
}

const uri = process.env.MONGODB_URI;
console.log('URI length:', uri ? uri.length : 'undefined');

if (!uri) {
    console.error('MONGODB_URI is not defined in .env.local');
    process.exit(1);
}

const StudentSchema = new mongoose.Schema({
    name: String,
    faceDescriptor: [Number]
});

// Use a try-catch block for model compiling to avoid overwrite error if run multiple times in same process (unlikely but safe)
let Student;
try {
    Student = mongoose.model('Student');
} catch {
    Student = mongoose.model('Student', StudentSchema);
}

async function checkStudents() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const count = await Student.countDocuments();
        console.log(`Total Students: ${count}`);

        const withDescriptor = await Student.countDocuments({ faceDescriptor: { $exists: true, $not: { $size: 0 } } });
        console.log(`Students with Descriptors: ${withDescriptor}`);

        if (withDescriptor > 0) {
            const students = await Student.find({ faceDescriptor: { $exists: true, $not: { $size: 0 } } }).limit(5);
            students.forEach(s => {
                console.log(`- ${s.name}: Descriptor Length ${s.faceDescriptor.length}`);
                // Verify values are numbers
                const isNumbers = s.faceDescriptor.every(n => typeof n === 'number' && !isNaN(n));
                console.log(`  - Valid Numbers: ${isNumbers}`);
            });
        } else {
            console.log("WARNING: No students have face descriptors!");
        }

    } catch (error) {
        console.error('Error in checkStudents:', error);
    } finally {
        console.log('Disconnecting...');
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

checkStudents().catch(err => console.error('Top Level Error:', err));
