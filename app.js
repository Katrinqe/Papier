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

// --- Security & Verschlüsselung ---
const SECRET_KEY_NAME = 'papier_app_secret_key';
let appSecretKey = localStorage.getItem(SECRET_KEY_NAME);

// Temporäre lokale Schlüsselgenerierung (wird später durch Firebase-Abruf ersetzt)
if (!appSecretKey) {
    appSecretKey = CryptoJS.lib.WordArray.random(256/8).toString();
    localStorage.setItem(SECRET_KEY_NAME, appSecretKey);
}

function encryptData(data) {
    return CryptoJS.AES.encrypt(data, appSecretKey).toString();
}

function decryptData(cipherText) {
    try {
        const bytes = CryptoJS.AES.decrypt(cipherText, appSecretKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        return null;
    }
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

    // NEU: Daten symmetrisch verschlüsseln
    const encryptedData = encryptData(dataString);

    // QR Code generieren
    currentQR = new QRious({
        element: document.getElementById('qr-canvas'),
        value: encryptedData, // NEU: Verschlüsselten String in den Code schreiben
        size: 250,
        level: 'H'
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
            // NEU: Zuerst den gescannten Text entschlüsseln
            const decryptedText = decryptData(decodedText);
            
            if (!decryptedText) {
                throw new Error("Entschlüsselung fehlgeschlagen.");
            }

            // Daten aus dem entschlüsselten Text entpacken
            const dataObj = JSON.parse(decryptedText);
            
            document.getElementById('res-gewicht').textContent = `${dataObj.g} kg`;
            document.getElementById('res-datum').textContent = dataObj.d;
            document.getElementById('res-qualitaet').textContent = dataObj.q;
            
            switchView('view-scan-result');
        } catch (e) {
            alert("Sicherheitswarnung: Dieser QR-Code kann mit dem aktuellen Gerät/Schlüssel nicht gelesen werden oder ist ungültig.");
            switchView('view-main');
        }
    }).catch(err => console.error(err));
}

function onScanFailure(error) {
    // Wird kontinuierlich aufgerufen, solange kein Code erkannt wird. Kann ignoriert werden.
}

// --- Navigation Logik ---
document.getElementById('nav-home').addEventListener('click', () => {
    switchView('view-main');
    document.getElementById('nav-home').classList.add('active');
    document.getElementById('nav-history').classList.remove('active');
});

document.getElementById('nav-history').addEventListener('click', () => {
    switchView('view-history');
    document.getElementById('nav-history').classList.add('active');
    document.getElementById('nav-home').classList.remove('active');
    renderHistory(); // Lade die Historie neu, wenn der Tab geöffnet wird
});

// --- LocalStorage & History Logik ---
const HISTORY_KEY = 'papier_app_history';

function getHistory() {
    const historyData = localStorage.getItem(HISTORY_KEY);
    return historyData ? JSON.parse(historyData) : [];
}

function saveToHistory() {
    // Hole die aktuellen Eingabewerte, die zur Generierung genutzt wurden
    const gewicht = document.getElementById('gewicht').value;
    const datum = document.getElementById('datum').value;
    const qualitaet = document.getElementById('qualitaet').value;
    const canvas = document.getElementById('qr-canvas');
    const qrImageBase64 = canvas.toDataURL("image/png"); // Das fertige Bild für die Card

    const newEntry = {
        id: Date.now(),
        gewicht: parseFloat(gewicht),
        datum: datum,
        qualitaet: qualitaet,
        qrImage: qrImageBase64
    };

    const history = getHistory();
    history.unshift(newEntry); // Neues Element ganz oben einfügen
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    alert("Erfolgreich in der Historie gespeichert!");
    updateDashboardStats(); // Statistik auf Home aktualisieren
    
    // Nach dem Speichern zurück zum Home-Screen
    switchView('view-main');
}

// Event-Listener für den neuen "In Historie speichern"-Button
document.getElementById('btn-save-history').addEventListener('click', saveToHistory);

// Historie auf dem Bildschirm rendern (Aktualisiert für Klickbarkeit)
function renderHistory() {
    const historyList = document.getElementById('history-list');
    const history = getHistory();

    historyList.innerHTML = ''; // Liste leeren

    if (history.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #6b7280; font-size: 0.9rem;">Noch keine Einträge vorhanden.</p>';
        return;
    }

    history.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'history-card';
        // Klick-Event für die Detail-Ansicht
        card.onclick = () => openHistoryDetail(entry.id);
        
        card.innerHTML = `
            <div class="history-info">
                <span class="badge">${entry.qualitaet.toUpperCase()}</span>
                <span class="detail">${entry.gewicht} kg</span>
                <span class="detail" style="color: #9ca3af; font-size: 0.75rem;">${entry.datum}</span>
            </div>
            <img src="${entry.qrImage}" class="history-qr-img" alt="QR Code">
        `;
        historyList.appendChild(card);
    });
}

// Statistik auf dem Home-Screen aktualisieren
function updateDashboardStats() {
    const history = getHistory();
    const totalCodes = history.length;
    
    // Berechne das Gesamtgewicht
    const totalWeight = history.reduce((sum, entry) => sum + entry.gewicht, 0);
    
    // Letztes Datum holen (da wir mit unshift() arbeiten, ist index 0 das aktuellste)
    const lastDate = totalCodes > 0 ? history[0].datum : null;

    // Nutze die Funktion, die wir im vorherigen Schritt vorbereitet haben
    updateStatistics(totalCodes, totalWeight, lastDate);
}

// Beim allerersten Laden der App die Statistik initialisieren
document.addEventListener('DOMContentLoaded', () => {
    updateDashboardStats();
});

// --- History Detail Logik ---
let currentDetailId = null;

function openHistoryDetail(id) {
    const history = getHistory();
    const entry = history.find(e => e.id === id);
    if (!entry) return;

    currentDetailId = id; // ID für Speichern/Löschen merken
    
    // Daten in die Detail-Ansicht laden
    document.getElementById('detail-qr-img').src = entry.qrImage;
    document.getElementById('detail-gewicht').textContent = `${entry.gewicht} kg`;
    document.getElementById('detail-datum').textContent = entry.datum;
    document.getElementById('detail-qualitaet').textContent = entry.qualitaet.toUpperCase();

    switchView('view-history-detail');
}

// Button: Zurück
document.getElementById('btn-detail-back').addEventListener('click', () => {
    switchView('view-history');
});

// Button: In Galerie speichern
document.getElementById('btn-detail-save').addEventListener('click', () => {
    const history = getHistory();
    const entry = history.find(e => e.id === currentDetailId);
    if (!entry) return;

    const link = document.createElement('a');
    link.href = entry.qrImage;
    link.download = `papier-qr-${entry.datum}.png`;
    link.click();
});

// Button: Eintrag löschen
document.getElementById('btn-detail-delete').addEventListener('click', () => {
    const confirmDelete = confirm("Möchtest du diesen Eintrag wirklich löschen?");
    if (confirmDelete) {
        let history = getHistory();
        // Den spezifischen Eintrag herausfiltern
        history = history.filter(e => e.id !== currentDetailId);
        
        // Aktualisierte Historie speichern
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        
        // Statistik auf dem Dashboard sofort aktualisieren
        updateDashboardStats();
        
        // Zurück zur Historien-Ansicht und Liste neu laden
        renderHistory();
        switchView('view-history');
    }
});
