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
