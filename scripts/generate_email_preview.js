// generate_email_preview.js - preview the send-report HTML without running the server
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function formatNoteTimestamp(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const yy = String(d.getFullYear()).slice(-2);
    let hrs = d.getHours();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    if (hrs === 0) hrs = 12;
    const mins = pad2(d.getMinutes());
    return `${mm}/${dd}/${yy} | ${hrs}:${mins} ${ampm}`;
}
function formatHourValue(val) {
    const num = Number(val);
    if (Number.isFinite(num)) {
        return num.toFixed(1);
    }
    return null;
}

const sample = {
    startTime: new Date().toISOString(),
    currentHours: 18.25,
    fastType: 'wet',
    notes: [
        { time: new Date().toISOString(), text: 'Felt energetic', fastHours: 18.3 },
        { time: new Date(Date.now() - 3600 * 1000).toISOString(), text: 'Drank water', fastHours: 17.3 }
    ],
    recipientEmail: 'test@example.com'
};

const notesSorted = (sample.notes || []).slice().sort((a,b) => new Date(b.time) - new Date(a.time));
const notesHtml = notesSorted.map(note => {
    const timeStr = formatNoteTimestamp(note.time);
    const atHourRaw = note.fastHours ?? note.fastHour ?? note.duration ?? null;
    const atHour = formatHourValue(atHourRaw);
    const prefix = atHour != null ? `${timeStr} @ ${atHour}h` : `${timeStr}`;
    return `<li style="margin-bottom: 8px; color: #000;"><strong>${prefix}</strong> — ${note.text}</li>`;
}).join('');

// Build trophies similar to server logic for preview
const hrs = Number(sample.currentHours) || 0;
const goldCount = Math.floor(hrs / 24);
const remainder = hrs - goldCount * 24;
const showPartial = goldCount >= 1 && remainder >= 6;
const partialIsSilver = remainder >= 12;
let trophyHtml = '';
const svgFor = (color, size = 18) => `\n        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle; margin-right:6px;">\n            <path d="M12 2l2.09 4.24L18.6 7l-3.3 2.9L16 14l-4-2-4 2 0.7-4.1L4.4 7l4.51-0.76L12 2z" fill="${color}" />\n        </svg>`;
for (let i = 0; i < goldCount; i++) {
    trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;"><span style=\"font-size:18px; line-height:1; margin-right:6px;\">🏆</span>${svgFor('#FFD700', 18)}</span>`;
}
if (showPartial) {
    if (partialIsSilver) trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;"><span style=\"font-size:16px; line-height:1; margin-right:6px;\">🥈</span>${svgFor('#C0C0C0', 16)}</span>`;
    else trophyHtml += `<span style="display:inline-flex; align-items:center; vertical-align:middle; margin-right:6px;"><span style=\"font-size:16px; line-height:1; margin-right:6px;\">🥉</span>${svgFor('#CD7F32', 16)}</span>`;
}
if (!trophyHtml) trophyHtml = '<span style="color:#666;">No trophies yet</span>';

const mailHtml = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="margin-bottom:12px;">${trophyHtml}</div>
    <h2 style="color: #000;">Fasting Report Summary</h2>
    <p><strong>Fast Start Time:</strong> ${new Date(sample.startTime).toLocaleString()}</p>
    <p><strong>Current Hours Fasted:</strong> ${sample.currentHours.toFixed(2)} hours</p>
    <p><strong>Fast Type:</strong> <span style="font-weight: bold; text-transform: uppercase; color: ${sample.fastType === 'dry' ? '#D32F2F' : '#2196F3'};">${sample.fastType} Fast</span></p>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
    <h3 style="color: #000;">Fasting Notes:</h3>
    ${sample.notes.length > 0 ? `<ul style="padding-left: 20px; list-style-type: none; color: #000;">${notesHtml}</ul>` : '<p>No notes logged during this fast.</p>'}
</div>
`;

console.log(mailHtml);
