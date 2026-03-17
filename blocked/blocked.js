/**
 * FocusLock — Blocked Page Script
 * Reads the blocked site from URL params and shows remaining timer from storage.
 */
'use strict';

let latestEndTime = null;
let renderLoopId = null;

(async function () {
    // ── Read site from URL param (set by the DNR redirect rule) ──
    const params = new URLSearchParams(window.location.search);
    const site = params.get('site') || 'This site';
    const siteEl = document.getElementById('site-name');
    if (siteEl) siteEl.textContent = site;

    // ── Load timer state from service worker ──
    try {
        const resp = await sendMessage({ type: 'GET_STATE' });
        latestEndTime = resp.timer?.endTime;

        // Start live countdown loop
        renderLoopId = requestAnimationFrame(renderLoop);

        // Cleanup loop on exit
        window.addEventListener('unload', () => cancelAnimationFrame(renderLoopId));

        // Poll every 10s just in case time is added remotely
        setInterval(async () => {
            try {
                const r = await sendMessage({ type: 'GET_STATE' });
                latestEndTime = r.timer?.endTime;

                // If time was re-earned, navigate away
                if (latestEndTime && latestEndTime > Date.now()) {
                    history.length > 1 ? history.back() : window.close();
                }
            } catch { /* silent */ }
        }, 10_000);

    } catch {
        const el = document.getElementById('time-remaining');
        if (el) el.textContent = 'Unavailable';
    }

    // ── Back button ──
    document.getElementById('back-btn')?.addEventListener('click', () => {
        history.length > 1 ? history.back() : window.close();
    });
})();

function renderLoop() {
    let remaining = 0;
    if (latestEndTime) {
        remaining = Math.max(0, Math.floor((latestEndTime - Date.now()) / 1000));
    }

    const el = document.getElementById('time-remaining');
    if (el) el.textContent = remaining > 0 ? formatTime(remaining) : '00:00';

    // Auto navigation is handled by the 10s polling interval above, this loop is just for UI
    renderLoopId = requestAnimationFrame(renderLoop);
}

function sendMessage(payload) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(response ?? {});
        });
    });
}

function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
