
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import Student from '../src/models/Student';
import Staff from '../src/models/Staff';

async function checkDescriptors() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI is not defined in .env.local');
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const students = await Student.find({});
        console.log(`\nTotal Students: ${students.length}`);

        let studentsWithDescriptors = 0;
        students.forEach(s => {
            if (s.faceDescriptor && s.faceDescriptor.length > 0) {
                studentsWithDescriptors++;
                if (s.faceDescriptor.length !== 128) {
                    console.warn(`Warning: Student ${s.name} has descriptor length ${s.faceDescriptor.length} (expected 128)`);
                }
            } else {
                console.log(`- Student without descriptor: ${s.name}`);
            }
        });
        console.log(`Students with Valid Descriptors: ${studentsWithDescriptors}`);


        const staff = await Staff.find({});
        console.log(`\nTotal Staff: ${staff.length}`);

        let staffWithDescriptors = 0;
        staff.forEach(s => {
            if (s.faceDescriptor && s.faceDescriptor.length > 0) {
                staffWithDescriptors++;
                if (s.faceDescriptor.length !== 128) {
                    console.warn(`Warning: Staff ${s.name} has descriptor length ${s.faceDescriptor.length} (expected 128)`);
                }
            } else {
                console.log(`- Staff without descriptor: ${s.name}`);
            }
        });
        console.log(`Staff with Valid Descriptors: ${staffWithDescriptors}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkDescriptors();
