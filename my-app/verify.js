
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockDataPath = path.join(__dirname, 'src/data/mockData.json');

try {
    const data = fs.readFileSync(mockDataPath, 'utf8');
    const json = JSON.parse(data);
    console.log('JSON is valid.');
    console.log('RECENT_LOGS count:', json.RECENT_LOGS.length);

    // Check for required fields
    const requiredFields = ['id', 'date', 'time', 'status', 'stage'];
    let valid = true;
    json.RECENT_LOGS.forEach((log, i) => {
        requiredFields.forEach(field => {
            if (log[field] === undefined) {
                console.error(`Log at index ${i} missing field ${field}`);
                valid = false;
            }
        });
    });

    if (valid) console.log('All logs have required fields.');

} catch (e) {
    console.error('Error parsing JSON:', e.message);
}
