import { createClientFromRequest, serve, handlerFor } from '../lib/sdk.js';

serve(async (req) => {
  try {
    const client = createClientFromRequest(req);
    const user = await client.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized', success: false, students: [] }, { status: 401 });
    }

    const body = await req.json();
    const { file_url, file_type } = body;
    
    if (!file_url) {
      throw new Error('file_url is required');
    }
    console.log('📂 Parsing file:', { file_url, file_type });

    // Fetch file content
    const fileResponse = await fetch(file_url);
    
    if (!fileResponse.ok) {
      throw new Error('Failed to fetch file from URL');
    }

    let parsedData = [];

    // CSV Parsing - try manual first
    if (file_type === 'csv' || file_url.endsWith('.csv')) {
      console.log('📄 Processing CSV file...');
      const csvText = await fileResponse.text();
      console.log('CSV text length:', csvText.length);
      
      try {
        parsedData = parseCSV(csvText);
        console.log('✅ CSV parsed manually:', parsedData.length, 'students');
      } catch (csvError) {
        console.log('⚠️ Manual CSV parsing failed:', csvError.message);
        console.log('Trying AI extraction as fallback...');
        
        try {
          const extractResult = await client.integrations.Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: getSimplifiedSchema()
          });
          
          if (extractResult.status === 'success' && extractResult.output) {
            parsedData = normalizeExtractedData(extractResult.output);
            console.log('✅ AI extracted:', parsedData.length, 'students');
          } else {
            throw new Error('AI extraction also failed: ' + (extractResult.details || 'Unknown error'));
          }
        } catch (aiError) {
          console.error('AI extraction error:', aiError);
          throw new Error(`Both CSV parsing and AI extraction failed. CSV error: ${csvError.message}`);
        }
      }
    }
    
    // Excel, PDF, HTML - use AI extraction only
    else {
      console.log('📊 Using AI extraction for', file_type);
      
      const extractResult = await client.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: getSimplifiedSchema()
      });
      
      console.log('🔍 Extraction result:', extractResult.status);
      
      if (extractResult.status === 'success' && extractResult.output) {
        parsedData = normalizeExtractedData(extractResult.output);
        console.log('✅ AI extracted:', parsedData.length, 'students');
      } else {
        const errorMsg = extractResult.details || extractResult.error || 'Failed to parse file';
        console.error('❌ Extraction failed:', errorMsg);
        throw new Error(`Could not parse ${file_type} file: ${errorMsg}`);
      }
    }

    // Validate parsed data
    const validStudents = parsedData.filter(s => {
      const hasIdentity = s.roll_no || s.prn;
      const hasName = s.name && s.name.length > 2;
      return hasIdentity && hasName;
    });

    console.log('✅ Final valid students:', validStudents.length);

    if (validStudents.length === 0) {
      throw new Error('No valid student records detected. Please ensure file has Roll No/PRN and Student Name columns.');
    }

    return Response.json({
      success: true,
      students: validStudents,
      count: validStudents.length,
      detected_columns: parsedData.length > 0 ? Object.keys(parsedData[0]) : []
    });

  } catch (error) {
    console.error('❌ Parse error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Failed to parse attendance file',
      students: []
    }, { status: 200 }); // Return 200 to avoid frontend error
  }
});

// CSV Parser with dynamic column detection
function parseCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV file has insufficient data');

  console.log('📄 Parsing CSV with', lines.length, 'lines');

  // Find header row
  let headerIndex = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const testHeaders = parseCSVLine(lines[i]);
    const headerText = testHeaders.join('|').toUpperCase();
    
    if (headerText.includes('ROLL') || headerText.includes('NAME') || headerText.includes('STUDENT')) {
      headerIndex = i;
      headers = testHeaders.map(h => h.trim());
      console.log('✅ Found header at line', i, ':', headers.slice(0, 5));
      break;
    }
  }

  if (headerIndex === -1 || headers.length < 2) {
    throw new Error('Could not detect header row with Roll/Name columns');
  }

  // Identify column indices
  const rollIndex = headers.findIndex(h => /roll|serial|sl|sr/i.test(h));
  const nameIndex = headers.findIndex(h => /student.*name|name|student/i.test(h) && !/college/i.test(h));
  const prnIndex = headers.findIndex(h => /prn|registration/i.test(h));
  
  if (rollIndex === -1 || nameIndex === -1) {
    throw new Error('Could not find Roll No and Student Name columns');
  }
  
  console.log('📌 Column mapping:', { rollIndex, nameIndex, prnIndex });
  
  // Find date/session columns (exclude metadata columns)
  const dateColumns = [];
  headers.forEach((h, idx) => {
    const isMetadata = idx === rollIndex || idx === nameIndex || idx === prnIndex;
    if (!isMetadata && h && h.trim().length > 0) {
      // Check if it looks like a date or session
      if (/\d{1,2}[.\/\-]\d{1,2}|\d{4}|session|date/i.test(h) || idx > nameIndex) {
        dateColumns.push({ index: idx, date: h.trim() });
      }
    }
  });

  console.log('📅 Found', dateColumns.length, 'date/session columns');

  const students = [];
  
  // Parse student rows
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip summary rows
    if (/^(total|average|grand|sum)/i.test(line)) continue;
    
    const cells = parseCSVLine(line);
    if (cells.length < Math.max(rollIndex, nameIndex) + 1) continue;

    const rollNo = cells[rollIndex]?.trim();
    const name = cells[nameIndex]?.trim();
    
    if (!name || name.length < 2) continue;

    // Parse attendance marks
    const attendanceRecords = [];
    let presentCount = 0;
    let totalSessions = 0;

    dateColumns.forEach(({ index, date }) => {
      if (cells[index]) {
        const mark = cells[index].trim().toUpperCase();
        if (['P', 'PRESENT', '✓', '✔', 'Y', 'YES', '1'].includes(mark)) {
          attendanceRecords.push({ date, status: 'present' });
          presentCount++;
          totalSessions++;
        } else if (['A', 'ABSENT', 'X', '✗', 'N', 'NO', '0', '-'].includes(mark)) {
          attendanceRecords.push({ date, status: 'absent' });
          totalSessions++;
        }
      }
    });

    students.push({
      roll_no: rollNo || (students.length + 1).toString(),
      name: name.toUpperCase(),
      prn: cells[prnIndex]?.trim() || '',
      attendance_records: attendanceRecords,
      present_count: presentCount,
      total_sessions: totalSessions,
      attendance_percentage: totalSessions > 0 
        ? parseFloat(((presentCount / totalSessions) * 100).toFixed(2))
        : 0
    });
  }

  console.log('✅ CSV parsed:', students.length, 'students');
  
  if (students.length === 0) {
    throw new Error('No valid student records found in CSV');
  }

  return students;
}

// Helper to parse CSV line with quoted fields
function parseCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  
  return cells;
}

// Simplified schema for AI extraction - more flexible
function getSimplifiedSchema() {
  return {
    type: "object",
    properties: {
      students: {
        type: "array",
        description: "Extract ALL student rows from the attendance table. Ignore header/metadata rows like college name, batch info. Only extract actual student data rows.",
        items: {
          type: "object",
          properties: {
            roll_no: {
              type: "string",
              description: "Student roll number or serial number (first column usually)"
            },
            prn: {
              type: "string",
              description: "PRN / Registration number if present"
            },
            name: {
              type: "string",
              description: "Full student name (required)"
            },
            attendance_records: {
              type: "array",
              description: "For each date/session column, record the attendance. Convert 'P', 'Present', checkmark, tick to 'present'. Convert 'A', 'Absent', 'X', cross to 'absent'. Skip empty cells.",
              items: {
                type: "object",
                properties: {
                  date: { 
                    type: "string",
                    description: "Date or session identifier from column header"
                  },
                  status: { 
                    type: "string",
                    enum: ["present", "absent"],
                    description: "present or absent"
                  }
                }
              }
            }
          },
          required: ["name"]
        }
      }
    },
    required: ["students"]
  };
}

// Normalize AI-extracted data
function normalizeExtractedData(output) {
  if (!output || !output.students) {
    console.log('⚠️ No students in output');
    return [];
  }
  
  const students = Array.isArray(output.students) ? output.students : [];
  console.log('📊 Normalizing', students.length, 'students');
  
  const normalized = students.map((student, idx) => {
    // Calculate attendance stats
    let presentCount = 0;
    let totalSessions = 0;
    const records = student.attendance_records || [];
    
    if (records.length > 0) {
      records.forEach(r => {
        if (r.status === 'present' || r.status === 'P') {
          presentCount++;
        }
        if (r.status === 'present' || r.status === 'absent') {
          totalSessions++;
        }
      });
    }
    
    const attendancePercentage = totalSessions > 0
      ? parseFloat(((presentCount / totalSessions) * 100).toFixed(2))
      : 0;

    return {
      roll_no: (student.roll_no || idx + 1).toString().trim(),
      name: (student.name || '').trim().toUpperCase(),
      prn: (student.prn || '').toString().trim(),
      attendance_records: records,
      present_count: presentCount,
      total_sessions: totalSessions,
      attendance_percentage: attendancePercentage
    };
  });
  
  // Filter valid students
  const valid = normalized.filter(s => s.name && s.name.length > 2);
  console.log('✅ Valid students after normalization:', valid.length);
  
  return valid;
}

export default handlerFor(import.meta.url);
