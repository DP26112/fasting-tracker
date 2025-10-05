// scheduler.js - small utility for computing the nextSendAt anchor-aligned timestamp
function computeNextSend(startTimeIso, nowIso = null, intervalHours = 6) {
    const start = new Date(startTimeIso);
    if (isNaN(start.getTime())) throw new Error('Invalid startTime');
    const now = nowIso ? new Date(nowIso) : new Date();

    const firstAnchor = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    if (now < firstAnchor) return firstAnchor;

    const diffMs = now.getTime() - firstAnchor.getTime();
    const intervalsPassed = Math.floor(diffMs / (intervalHours * 60 * 60 * 1000));
    const next = new Date(firstAnchor.getTime() + (intervalsPassed + 1) * intervalHours * 60 * 60 * 1000);
    return next;
}

module.exports = { computeNextSend };
