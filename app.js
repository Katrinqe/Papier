// Aktuelles Datum standardmäßig in das Datumsfeld eintragen
document.getElementById('datum').valueAsDate = new Date();

// Service Worker registrieren (zwingend erforderlich für PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker erfolgreich registriert', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker Registrierung fehlgeschlagen: ', err);
            });
    });
}

// --- Neue UI Logik ---

// Diese Funktion füttern wir später mit den echten Firebase-Daten
function updateStatistics(totalCodes, totalWeight, lastDate) {
    document.getElementById('stat-count').textContent = totalCodes > 0 ? totalCodes : '---';
    document.getElementById('stat-weight').textContent = totalWeight > 0 ? totalWeight.toFixed(1) : '---';
    document.getElementById('stat-date').textContent = lastDate ? lastDate : '---';
}

// Event-Listener für die neuen Buttons (aktuell ohne Funktion, aber vorbereitet)
document.getElementById('btn-create').addEventListener('click', () => {
    console.log('Create QR Code geklickt - Funktion wird im nächsten Schritt implementiert.');
});

document.getElementById('btn-scan').addEventListener('click', () => {
    console.log('Scan QR Code geklickt - Funktion wird im nächsten Schritt implementiert.');
});
