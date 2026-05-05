const fs = require('fs');
const csvPath = '/home/cntrlx/Downloads/Scheduler_Timesheet_Export_2026-05-05-00-42.csv';
const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');

const data = lines.slice(1).map(line => {
  const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  if (!parts || parts.length < 16) return null;
  return {
    staffName: parts[3],
    startStr: parts[5],
    endStr: parts[6]
  };
}).filter(Boolean);

const startsOn25th = data.filter(d => d.startStr && d.startStr.includes('2026-04-25'));
const endsOn25th = data.filter(d => d.endStr && d.endStr.includes('2026-04-25'));

console.log('Shifts starting on 25th:', startsOn25th.length);
if (startsOn25th.length > 0) {
  console.log('First few starting:');
  console.log(startsOn25th.slice(0, 3));
}

console.log('Shifts ending on 25th:', endsOn25th.length);
if (endsOn25th.length > 0) {
  console.log('First few ending:');
  console.log(endsOn25th.slice(0, 3));
}
