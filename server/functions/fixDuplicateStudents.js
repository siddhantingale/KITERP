import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';

serve(async (req) => {
    try {
        const client = createClientFromRequest(req);
        const user = await client.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all students
        const allStudents = await client.asServiceRole.entities.Student.list('-created_date', 10000);
        
        // Find duplicates by PRN
        const prnMap = new Map();
        const duplicates = [];
        
        for (const student of allStudents) {
            const prn = student.prn;
            if (!prn) continue;
            
            if (prnMap.has(prn)) {
                // This is a duplicate - mark for deletion
                duplicates.push({
                    id: student.id,
                    prn: student.prn,
                    name: student.name,
                    batch_id: student.batch_id
                });
            } else {
                prnMap.set(prn, student);
            }
        }
        
        // Delete duplicates (keeping the oldest one)
        let deletedCount = 0;
        for (const dup of duplicates) {
            await client.asServiceRole.entities.Student.delete(dup.id);
            deletedCount++;
        }
        
        // Get all batches
        const batches = await client.asServiceRole.entities.Batch.list('-created_date', 100);
        
        // Update student count for each batch
        const batchUpdates = [];
        for (const batch of batches) {
            const studentsInBatch = await client.asServiceRole.entities.Student.filter({ batch_id: batch.batch_id });
            const actualCount = studentsInBatch.length;
            
            if (batch.student_count !== actualCount) {
                await client.asServiceRole.entities.Batch.update(batch.id, {
                    student_count: actualCount
                });
                batchUpdates.push({
                    batch_name: batch.batch_name,
                    old_count: batch.student_count,
                    new_count: actualCount
                });
            }
        }
        
        return Response.json({
            success: true,
            duplicates_deleted: deletedCount,
            duplicate_details: duplicates,
            batch_updates: batchUpdates,
            total_students_remaining: allStudents.length - deletedCount
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

export default handlerFor(import.meta.url);
