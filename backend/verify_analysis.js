
import { analyzeCsv } from './utils/csvAnalyzer.js';
import path from 'path';

const csvFile = 'test.csv';

console.log(`Testing analysis on ${csvFile}...`);

try {
    const results = await analyzeCsv(path.resolve(csvFile));
    console.log('Analysis complete!');
    console.log('Number of rows processed:', results.length);

    // Check for specific fields in the first result with analysis
    const analyzedRow = results.find(r => r.analysis_result && !r.analysis_result.error);

    if (analyzedRow) {
        console.log('Sample Analysis Result (First Row):');
        console.log(JSON.stringify(analyzedRow.analysis_result, null, 2));
    } else {
        console.log('No successful analysis found in results.');
    }

} catch (error) {
    console.error('Verification failed:', error);
}
