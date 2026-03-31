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

// --- View Management ---
function switchView(viewId) {
    document.querySelectorAll('.app-wrapper').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// --- QR-Code Generierung & Speichern ---
let currentQR = null;

document.getElementById('btn-create').addEventListener('click', () => {
    const gewicht = document.getElementById('gewicht').value;
    const datum = document.getElementById('datum').value;
    const qualitaet = document.getElementById('qualitaet').value;

    if (!gewicht || !datum || !qualitaet) {
        alert("Bitte fülle alle Felder aus.");
        return;
    }

    // Daten als kompaktes JSON-Objekt vorbereiten
    const dataObj = { g: gewicht, d: datum, q: qualitaet };
    const dataString = JSON.stringify(dataObj);

    // QR Code generieren
    currentQR = new QRious({
        element: document.getElementById('qr-canvas'),
        value: dataString,
        size: 250,
        level: 'H' // Hohe Fehlerkorrektur, gut für Ausdrucke
    });

    switchView('view-qr');
});

// QR-Code in Galerie speichern (Download)
document.getElementById('btn-save-qr').addEventListener('click', () => {
    const canvas = document.getElementById('qr-canvas');
    const image = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = image;
    link.download = `papier-qr-${document.getElementById('datum').value}.png`;
    link.click();
});

// Zurück-Buttons
document.getElementById('btn-back-from-qr').addEventListener('click', () => switchView('view-main'));
document.getElementById('btn-back-from-res').addEventListener('click', () => switchView('view-main'));

// --- Scanner Logik ---
let html5QrcodeScanner = null;

document.getElementById('btn-scan').addEventListener('click', () => {
    switchView('view-scanner');
    
    // Scanner initialisieren
    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
    .catch(err => {
        alert("Kamera konnte nicht gestartet werden. Bitte Berechtigungen prüfen.");
    });
});

document.getElementById('btn-cancel-scan').addEventListener('click', () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            switchView('view-main');
        }).catch(err => console.error(err));
    } else {
        switchView('view-main');
    }
});

function onScanSuccess(decodedText, decodedResult) {
    // Scanner sofort stoppen, wenn erfolgreich
    html5QrcodeScanner.stop().then(() => {
        try {
            // Versuchen, die Daten aus dem QR-Code zu entpacken
            const dataObj = JSON.parse(decodedText);
            
            document.getElementById('res-gewicht').textContent = `${dataObj.g} kg`;
            document.getElementById('res-datum').textContent = dataObj.d;
            document.getElementById('res-qualitaet').textContent = dataObj.q;
            
            switchView('view-scan-result');
        } catch (e) {
            alert("Ungültiger QR-Code gescannt.");
            switchView('view-main');
        }
    }).catch(err => console.error(err));
}

function onScanFailure(error) {
    // Wird kontinuierlich aufgerufen, solange kein Code erkannt wird. Kann ignoriert werden.
}
