const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://mir:mirpunjab@cluster0.n1q16.mongodb.net/attendance-db?retryWrites=true&w=majority&appName=Cluster0')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Define schema inline to avoid imports
        const AttendanceLog = mongoose.models.AttendanceLog || mongoose.model('AttendanceLog', new mongoose.Schema({
            student_id: mongoose.Schema.Types.ObjectId,
            timestamp: Date,
            status: String,
            periodId: Number
        }));

        // Delete all logs
        const result = await AttendanceLog.deleteMany({});
        console.log(`Deleted ${result.deletedCount} logs.`);

        process.exit(0);
    })
    .catch((err) => {
        console.error('Error:', err);
        process.exit(1);
    });
