# Bubble 💬

*Entwickelt von Erlin Ramaj*

Eigener Messenger für dich und deine Freunde – Chat, Sprache, Video und Bildschirm teilen, auf deinem eigenen Server in der EU.

- **Gruppen** mit Text- und Sprachkanälen, **Direktnachrichten**
- **Sprach- und Videoanrufe** (1:1 und Gruppe), **Bildschirm teilen** bis 1440p (2K) mit 60 FPS, PC-Ton mitübertragen
- **Soundboard** mit Ordnern – im Chat oder live im Call
- **Eigener Bubble-Look:** schwebende Glas-Panels, echte Chat-Blasen, Dock-Leiste (umschaltbar auf klassisch)
- **32 Themes** (Aero Messenger 2009, PlayStation, Windows XP, Game Boy, Synthwave, Matrix …), eigene Themes mit **Video-, GIF- und Bild-Hintergründen**, Theme-Editor
- **Schriften** für Oberfläche und Chat frei wählbar, eigene Schriften importieren
- **Profile:** Banner (auch GIF), Bio, „Spielt gerade …“ (automatische Spielerkennung) und „Hört auf Spotify …“
- **GIFs/Bilder** als Profilbild, Gruppen-Icon und im Chat (Einfügen mit Strg+V oder Drag & Drop)
- **Eigene Töne** für Nachricht, Klingelton, Call verbunden, jemand kommt/geht …
- Mikro/Lautsprecher/Kamera wählen, Mikro-Test, Push-to-Talk, Lautstärke pro Person
- **Jede Person hat ihr eigenes Konto** (Benutzername + Passwort). Registrieren geht nur mit deinem Registrierungs-Code.

---

## Teil 1: Server einrichten (einmalig, ca. 30–45 Minuten)

### 1. Gratis-Server bei Oracle Cloud (EU)
1. Konto erstellen auf **cloud.oracle.com** („Always Free“). Als Heimatregion **Switzerland North (Zürich)** oder **Germany Central (Frankfurt)** wählen – das lässt sich später nicht ändern.
2. *Compute → Instances → Create Instance*
   - Image: **Ubuntu 24.04**
   - Shape: **Ampere (VM.Standard.A1.Flex)**, z.B. 2 OCPU / 12 GB RAM (gratis)
   - SSH-Schlüssel herunterladen und gut aufbewahren
   - Falls „Out of capacity“ kommt: später nochmals versuchen oder 1 OCPU / 6 GB nehmen.
3. Öffentliche IP-Adresse der Instanz notieren.
4. **Ports öffnen:** Instanz → *Subnet* → *Security List* → *Add Ingress Rules* (Quelle `0.0.0.0/0`):
   - TCP **80**, **443**, **7881**
   - UDP **50000–50100**

### 2. Gratis-Adresse bei DuckDNS
1. Auf **duckdns.org** anmelden, eine Subdomain anlegen, z.B. `meinegruppe` → ergibt `meinegruppe.duckdns.org`.
2. Bei „current ip“ die IP deines Oracle-Servers eintragen → *update ip*.
   (`rtc.meinegruppe.duckdns.org` funktioniert automatisch mit.)

### 3. Bubble auf dem Server starten
Per SSH verbinden (Windows-Terminal):
```bash
ssh -i pfad/zum/schluessel.key ubuntu@DEINE-IP
```
Dann:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
git clone https://github.com/erlinxrmj/Bubble.git   # privates Repo: als Passwort einen GitHub-Token eingeben
cd Bubble
bash setup.sh                 # fragt nach Domain und Registrierungs-Code
docker compose up -d --build
```
Test im Browser: `https://meinegruppe.duckdns.org/api/health` → zeigt `"ok": true`.

**Update später:** `git pull && docker compose up -d --build`
**Logs ansehen:** `docker compose logs -f server`
**Backup:** der Ordner `data/` enthält alle Konten, Nachrichten, Bilder und Sounds.

---

## Teil 2: Die PC-App

### Variante A: Automatisch von GitHub bauen lassen (empfohlen)
Sobald der Code auf GitHub liegt, baut GitHub die Windows-App selbst:
*Repo → Actions → „Bubble für Windows bauen“ → neuester Lauf → Artifacts → Bubble-Windows-Installer* herunterladen, entpacken, installieren.
Diese Datei kannst du deinen Freunden schicken.

### Variante B: Selbst bauen
[Node.js 22](https://nodejs.org) installieren, dann im Ordner `client`:
```bash
npm install
npm start        # App direkt starten
npm run dist     # Installer bauen → client/dist/
```

### Erster Start
1. **Registrieren** → Server-Adresse `meinegruppe.duckdns.org`, Benutzername, Passwort, Registrierungs-Code
2. Links auf **+** → Gruppe erstellen
3. Oben auf den Gruppennamen → **Freunde einladen** → Code an Freunde schicken
4. Freunde: App installieren, registrieren (mit deinem Registrierungs-Code), **+ → Beitreten** mit dem Einladungscode

---

## Eigene Themes

Einfachster Weg: *Einstellungen → Themes → + Eigenes Theme* – Farben, Hintergrund (Bild, GIF, Video oder animierter Farbverlauf), Glas-Effekt usw. zusammenklicken und speichern.

Themes sind `.json`-Dateien im Themes-Ordner (*Einstellungen → Themes → Ordner öffnen*). Videos, GIFs, Bilder und Schriftarten legst du einfach daneben. Beispiel:

```json
{
  "name": "Regen in Tokio",
  "dark": true,
  "colors": { "accent": "#ff5fa2", "bg-main": "rgba(0,0,0,0.55)", "bg-sidebar": "rgba(10,10,20,0.6)" },
  "blur": "12px",
  "background": { "type": "video", "src": "regen.mp4", "overlay": "rgba(0,0,0,0.3)" }
}
```
`background.type`: `video`, `image` (auch GIF), `gradient`, `animated`, `color`. Für `src` geht auch ein https-Link.
Themes kannst du per Rechtsklick exportieren und an Freunde schicken; sie importieren sie mit *Importieren*.

Alle Farbnamen: `bg-app, bg-guilds, bg-sidebar, bg-main, bg-elev, bg-input, bg-hover, bg-active, border, text, text-muted, text-strong, accent, accent-text, danger, success, warn, mention` – dazu `font`, `radius`, `blur` und `css` (eigenes CSS).

---

## Tastenkürzel
- **Strg+Shift+M** – Mikro stumm
- **Strg+Shift+D** – Ton aus
- **Push-to-Talk** – Taste in den Einstellungen wählbar (funktioniert, solange Bubble im Vordergrund ist)
- **Enter** senden, **Shift+Enter** neue Zeile, **Strg+V** Bild einfügen

## Gut zu wissen
- Bildschirm teilen in 1440p/60 FPS braucht ca. 10 Mbit/s Upload bei dir.
- Hochgeladene Bilder/Sounds sind über einen zufälligen, nicht erratbaren Link erreichbar.
- Der Oracle-Gratisserver hat 10 TB Datenvolumen pro Monat – für eine Freundesgruppe mehr als genug.
