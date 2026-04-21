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
// --- Neue UI Logik ---

function updateStatistics(totalCodes, totalWeight, lastDate) {
    // Die HTML-Felder für die Statistik wurden durch das Header-Bild ersetzt.
    // Diese Funktion bleibt leer, damit die App beim Speichern/Löschen nicht abstürzt.
}

// --- View Management ---
function switchView(viewId) {
    document.querySelectorAll('.app-wrapper').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// --- Create Flow Logic (ID & Batterie) ---
let currentQR = null;
let currentBatteryLevel = 0;

// Öffnet das Formular frisch
function openCreateForm() {
    // 7-stelligen Random String generieren
    const randomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    document.getElementById('pack-name').value = randomId;
    
    // Formular und Batterie resetten
    currentBatteryLevel = 0;
    updateBatteryUI();
    document.getElementById('gewicht').value = '';
    document.getElementById('qualitaet').value = '';
    document.getElementById('datum').valueAsDate = new Date();
    
    switchView('view-create-form');
}

// Batterie Klick-Logik
document.querySelectorAll('.battery-segment').forEach(seg => {
    seg.addEventListener('click', (e) => {
        currentBatteryLevel = parseInt(e.target.dataset.val);
        updateBatteryUI();
    });
});

function updateBatteryUI() {
    document.querySelectorAll('.battery-segment').forEach(seg => {
        if (parseInt(seg.dataset.val) <= currentBatteryLevel) {
            seg.classList.add('active');
        } else {
            seg.classList.remove('active');
        }
    });
}

// --- CREATE Button (Generiert QR, geht zur Vorschau) ---
document.getElementById('btn-create').addEventListener('click', () => {
    const name = document.getElementById('pack-name').value;
    const gewicht = document.getElementById('gewicht').value;
    const datum = document.getElementById('datum').value;
    const qualitaet = document.getElementById('qualitaet').value;

    if (!name || !gewicht || !datum || !qualitaet || currentBatteryLevel === 0) {
        alert("Bitte fülle alle Felder aus und wähle den Batteriestatus links (1-6).");
        return;
    }

    // Erweitertes JSON-Objekt (n = name, b = battery)
    const dataObj = { n: name, b: currentBatteryLevel, g: gewicht, d: datum, q: qualitaet };
    const encryptedData = encryptData(JSON.stringify(dataObj));

    currentQR = new QRious({
        element: document.getElementById('qr-canvas'),
        value: encryptedData,
        size: 250,
        level: 'H'
    });

    document.getElementById('qr-display-name').textContent = name;
    switchView('view-qr');
});

// --- QR Vorschau Buttons ---
document.getElementById('btn-delete-qr').addEventListener('click', () => {
    switchView('view-main'); // Bricht ab und geht zurück
});

document.getElementById('btn-save-qr').addEventListener('click', () => {
    const canvas = document.getElementById('qr-canvas');
    const image = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = image;
    link.download = `${document.getElementById('pack-name').value}.png`;
    link.click();
});

// Zurück-Button für den Scan-Ergebnis-Screen (muss erhalten bleiben)
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
            const decryptedText = decryptData(decodedText);
            if (!decryptedText) throw new Error("Entschlüsselung fehlgeschlagen.");

            const dataObj = JSON.parse(decryptedText);
            
            // NEU: Name und Batterie ins HTML laden (mit Fallback für ganz alte Codes)
            document.getElementById('res-name').textContent = dataObj.n || "Unbekanntes Pack";
            document.getElementById('res-battery').textContent = dataObj.b ? `Level ${dataObj.b}` : "---";
            
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

// --- Dashboard Navigation ---
function openHistoryFromDashboard() {
    renderHistory();
    switchView('view-history');
}

// --- Statistik & Dashboard Logik ---
function updateDashboardStats() {
    const history = getHistory();
    const totalCodes = history.length;
    
    // Berechne Gesamtgewicht
    const totalWeight = history.reduce((sum, entry) => sum + entry.gewicht, 0);
    
    // Berechne verkauftes Gewicht (Sucht nach einem "sold" flag)
    const totalSold = history
        .filter(entry => entry.sold === true)
        .reduce((sum, entry) => sum + entry.gewicht, 0);

    // Die neuen HTML-IDs aus dem Dashboard befüllen
    const countElement = document.getElementById('stat-count');
    const weightElement = document.getElementById('stat-weight');
    const soldElement = document.getElementById('stat-sold');

    if (countElement) countElement.textContent = totalCodes;
    if (weightElement) weightElement.textContent = totalWeight.toFixed(1);
    if (soldElement) soldElement.textContent = totalSold.toFixed(1);
}

// Beim allerersten Laden der App die Statistik initialisieren
document.addEventListener('DOMContentLoaded', () => {
    updateDashboardStats();
});

// --- LocalStorage & History Logik ---
const HISTORY_KEY = 'papier_app_history';

function getHistory() {
    const historyData = localStorage.getItem(HISTORY_KEY);
    return historyData ? JSON.parse(historyData) : [];
}

// Der ECHTE Save Button (speichert aus der Vorschau in die Historie)
document.getElementById('btn-save-history').addEventListener('click', () => {
    const name = document.getElementById('pack-name').value;
    const gewicht = document.getElementById('gewicht').value;
    const datum = document.getElementById('datum').value;
    const qualitaet = document.getElementById('qualitaet').value;
    const canvas = document.getElementById('qr-canvas');
    const qrImageBase64 = canvas.toDataURL("image/png");

    const newEntry = {
        id: Date.now(),
        name: name,
        battery: currentBatteryLevel,
        gewicht: parseFloat(gewicht),
        datum: datum,
        qualitaet: qualitaet,
        qrImage: qrImageBase64,
        sold: false
    };

    const history = getHistory();
    history.unshift(newEntry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    updateDashboardStats();
    switchView('view-main');
});

// --- Historie Rendern ---
function renderHistory() {
    const historyList = document.getElementById('history-list');
    const history = getHistory();

    historyList.innerHTML = ''; 

    if (history.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #6b7280; font-size: 0.9rem;">Noch keine Einträge vorhanden.</p>';
        return;
    }

    history.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.onclick = () => openHistoryDetail(entry.id);
        
        // Wenn es verkauft ist, markieren wir es optisch leicht anders (z.B. grauer Badge)
        const badgeColor = entry.sold ? 'background: #f3f4f6; color: #9ca3af;' : 'background: #dcfce7; color: #166534;';
        
        card.innerHTML = `
            <div class="history-info">
                <span class="badge" style="${badgeColor}">${entry.sold ? 'VERKAUFT' : entry.qualitaet.toUpperCase()}</span>
                <span class="detail">${entry.gewicht} kg</span>
                <span class="detail" style="color: #9ca3af; font-size: 0.75rem;">${entry.datum}</span>
            </div>
            <img src="${entry.qrImage}" class="history-qr-img" alt="QR Code">
        `;
        historyList.appendChild(card);
    });
}

// --- History Detail Logik ---
let currentDetailId = null;


    const history = getHistory();
    const entry = history.find(e => e.id === id);
    if (!entry) return;

    currentDetailId = id; 
    
    document.getElementById('detail-qr-img').src = entry.qrImage;
    document.getElementById('detail-gewicht').textContent = `${entry.gewicht} kg`;
    document.getElementById('detail-datum').textContent = entry.datum;
    document.getElementById('detail-qualitaet').textContent = entry.sold ? 'VERKAUFT' : entry.qualitaet.toUpperCase();

    switchView('view-history-detail');
}

// Buttons in der Detail-Ansicht
document.getElementById('btn-detail-back').addEventListener('click', () => {
    switchView('view-history');
});

document.getElementById('btn-detail-save').addEventListener('click', () => {
    const history = getHistory();
    const entry = history.find(e => e.id === currentDetailId);
    if (!entry) return;

    const link = document.createElement('a');
    link.href = entry.qrImage;
    link.download = `papier-qr-${entry.datum}.png`;
    link.click();
});

document.getElementById('btn-detail-delete').addEventListener('click', () => {
    const confirmDelete = confirm("Möchtest du diesen Eintrag wirklich löschen?");
    if (confirmDelete) {
        let history = getHistory();
        history = history.filter(e => e.id !== currentDetailId);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        
        updateDashboardStats();
        renderHistory();
        switchView('view-history');
    }
});
