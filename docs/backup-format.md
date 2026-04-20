# Phylax Backup-Format (`.phylax`)

Version: 1
Status: authoritative for ONB-01e onward
Referenziert durch: `src/features/backup-import/`, ADR-folgende Backup-Create-Task

---

## Ueberblick

Das `.phylax`-Format ist der einzige Weg, ein Phylax-Profil zwischen
Geraeten oder Browser-Instanzen zu uebertragen. Es enthaelt die
vollstaendige Gesundheitshistorie als verschluesselten Datencontainer.
Zero-Knowledge: ohne das Master-Passwort, mit dem das Backup erstellt
wurde, ist die Datei nicht entschluesselbar und Phylax kann sie nicht
wiederherstellen.

Die Import-Route ist `src/features/backup-import/`. Die Create-Route
(Export) wird in einer spaeteren Task implementiert, folgt aber genau
diesem Format.

---

## Dateistruktur

### Aeusserer Container (Klartext-JSON)

```json
{
  "version": 1,
  "type": "phylax-backup",
  "created": "2026-04-20T15:30:00Z",
  "source": {
    "app": "phylax",
    "appVersion": "0.0.0"
  },
  "crypto": {
    "algorithm": "AES-256-GCM",
    "kdf": "PBKDF2-SHA256",
    "iterations": 1200000,
    "salt": "<base64 32 bytes>"
  },
  "data": "<base64 [IV (12) || ciphertext || authTag (16)]>"
}
```

### Pflichtfelder

| Feld                | Typ     | Inhalt                                                              |
| ------------------- | ------- | ------------------------------------------------------------------- |
| `version`           | integer | Format-Version. V1 = `1`. Unbekannte Versionen -> Import bricht ab. |
| `type`              | string  | Muss exakt `"phylax-backup"` sein. Schuetzt vor Verwechslung.       |
| `created`           | string  | ISO-8601 UTC-Zeitstempel der Backup-Erstellung. Nur informativ.     |
| `source.app`        | string  | Erzeugende App. Muss `"phylax"` sein.                               |
| `source.appVersion` | string  | `package.json#version` zum Zeitpunkt der Erstellung.                |
| `crypto.algorithm`  | string  | Muss `"AES-256-GCM"` sein. V1 unterstuetzt nur diesen Algorithmus.  |
| `crypto.kdf`        | string  | Muss `"PBKDF2-SHA256"` sein.                                        |
| `crypto.iterations` | integer | PBKDF2-Iterationen. Gueltiger Bereich: `100_000` bis `10_000_000`.  |
| `crypto.salt`       | string  | Base64-kodiert, exakt 32 Byte nach Dekodierung.                     |
| `data`              | string  | Base64-kodierte verschluesselte Payload (siehe unten).              |

### `data`-Feld

Base64-Dekodierung ergibt den exakten Output von
`src/crypto/aesGcm.encrypt()`:

```
[IV (12 Byte)][Ciphertext][GCM-Authentifizierungstag (16 Byte)]
```

Die ersten 12 Byte sind der IV. Der Rest ist Ciphertext plus 16-Byte
Authentifizierungstag (GCM). Kein separates `iv`-Feld auf der
Container-Ebene - der IV ist Bestandteil der verschluesselten Payload,
identisch zur Speicherung in IndexedDB.

### Innere Plaintext-Payload (nach Entschluesselung)

```json
{
  "schemaVersion": 2,
  "rows": {
    "profiles": [ { "id": "...", "profileId": "...", "createdAt": 123, "updatedAt": 123, "baseData": {...}, ... } ],
    "observations": [ ... ],
    "lab_values": [ ... ],
    "lab_reports": [ ... ],
    "supplements": [ ... ],
    "open_points": [ ... ],
    "profile_versions": [ ... ],
    "documents": [ ... ],
    "timeline_entries": [ ... ]
  },
  "meta_settings": { "verificationToken": "phylax-verification-v1", "settings": { "autoLockMinutes": 5 }, "aiProvider": null }
}
```

Jede Zeile in `rows.<table>` ist ein dekodiertes Domain-Objekt. Keine
per-Zeile-Chiffrierung innerhalb der Payload. Der Import-Pfad
verschluesselt jede Zeile beim Schreiben mit dem Schluessel, der aus
dem Backup-Passwort abgeleitet wurde.

`meta_settings` traegt die dekodierten Settings (Auto-Lock-Timeout,
AI-Config falls vorhanden) aus dem Meta-Row.

### `schemaVersion`

Bezeichnet die Dexie-Schema-Version zum Zeitpunkt der Backup-Erstellung.
V1 akzeptiert nur `schemaVersion === 2` (die aktuelle Dexie-Version).
Migration vorwaerts oder rueckwaerts wird eingefuehrt, wenn es eine
konkrete Schema-Evolution gibt; strikte Gleichheit vermeidet
unvalidierte Kompat-Oberflaeche in V1.

---

## Sicherheitsbetrachtungen

### Was schuetzt das Format

- **Tamper-Detection**: AES-GCM-Authentifizierungstag erkennt jede
  Ciphertext-Modifikation. Veraenderte Dateien schlagen bei der
  Entschluesselung fehl - das ist das korrekte Verhalten.
- **Zero-Knowledge**: Der Inhalt ist ohne das erzeugende Master-Passwort
  kryptografisch nicht zugaenglich. Phylax besitzt keinen
  Wiederherstellungsmechanismus.

### Was das Format nicht adressiert

1. **Passwort-Substitution**: Das Import-Passwort wird zum neuen
   Master-Passwort auf dem Zielgeraet. Wer ein Backup mit dem Passwort
   "password123" erstellt, installiert Phylax neu mit genau diesem
   Master-Passwort. Das ist Spezifikation, kein Bug.
2. **Downgrade-Angriff auf `iterations`**: Die Krypto-Parameter liegen
   in der Datei. Ein Angreifer mit Schreibzugriff auf die Datei koennte
   `iterations` auf einen niedrigen Wert setzen, um Brute-Force zu
   beschleunigen. V1 begrenzt `iterations` auf den Bereich `100_000`
   bis `10_000_000`, um extreme Downgrades zu verhindern. Wer
   Schreibzugriff auf die Backup-Datei hat, hat typischerweise weitere
   Angriffsflaechen (Dateisystem, Zwischenablage). Die Integritaet der
   Datei ist Verantwortung des Nutzers.
3. **Metadaten-Leak**: `source.appVersion` und `created` sind nicht
   verschluesselt. Wer die Datei erhaelt, kennt Erstellungszeitpunkt
   und App-Version. Das wird als niedrig-sensitive Metadaten-Offenlegung
   akzeptiert.
4. **Groessen-Analyse**: Die Dateigroesse verraet ungefaehr den
   Umfang des Profils (Anzahl Zeilen \* mittlere Zeilengroesse).
   Bekanntes, hinnehmbares Leak.
5. **Nicht im Format**: keine Passwort-Hints, keine
   Recovery-Fragen, keine Hinterlegung. Die Datei ist ohne Passwort
   vollstaendig unzugaenglich.

### Salt-Generierung (Backup-Create)

Die Backup-Create-Implementierung **muss** pro Export einen frischen
32-Byte-Salt via `globalThis.crypto.getRandomValues` generieren, auch
wenn dasselbe Passwort wie fuer das aktuelle Vault verwendet wird.
Mehrfach-Exporte mit demselben Passwort duerfen nicht denselben Salt
nutzen - sonst kann ein Angreifer mit mehreren Backup-Dateien und
einem Vault-Ciphertext eine einzige PBKDF2-Derivation auf beide
anwenden. Dies wird vom Format nicht erzwungen (es ist eine
Implementation-Eigenschaft von Backup-Create), aber durch diese
Spezifikation vorgeschrieben.

---

## Parameter-Bereiche und Validierung

Beim Import (`parseBackupFile`):

| Feld                | Validierung                                             |
| ------------------- | ------------------------------------------------------- |
| `version`           | `=== 1`. Andernfalls `unsupported-version`.             |
| `type`              | `=== "phylax-backup"`. Andernfalls `wrong-type`.        |
| `crypto.iterations` | `>= 100_000 && <= 10_000_000`. Andernfalls `corrupted`. |
| Salt nach Base64    | `=== 32` Byte. Andernfalls `corrupted`.                 |
| IV-Segment in data  | `>= 12` Byte. Andernfalls `corrupted`.                  |
| Datei-Groesse       | `<= 50 MB`. Andernfalls `too-large`.                    |

Nach Entschluesselung:

| Feld             | Validierung                                 |
| ---------------- | ------------------------------------------- |
| JSON-Parse       | Erfolgreich. Andernfalls `corrupted`.       |
| `schemaVersion`  | `=== 2`. Andernfalls `unsupported-version`. |
| `rows` vorhanden | Als Objekt. Andernfalls `corrupted`.        |

---

## Forward-Compatibility

- Neue optionale Felder duerfen der Plaintext-Payload hinzugefuegt
  werden, solange `schemaVersion` entsprechend hochgezaehlt wird.
- Neue Pflichtfelder erfordern einen Version-Bump (`version: 2`) und
  dokumentierte Migration.
- Krypto-Algorithmus-Wechsel (z.B. PBKDF2 -> Argon2id) erfordert
  `version: 2`. `crypto.algorithm` + `crypto.kdf` werden beim Import
  geprueft; V1-Clients lehnen unbekannte Algorithmen ab.

---

## Bezug zu anderen Formaten

- **Markdown-Profil-Import** (`/import`): separates Feature. Klartext,
  Living-Health-Markdown-Format. Kein Bezug zu `.phylax`.
- **PDF-Export** (Phase 5): Klartext-Druckformat fuer Arztbesuche. Kein
  Backup-Format.
- **`.phylax`** (diese Spezifikation): einziges verschluesseltes
  Uebertragungsformat zwischen Geraeten.

---

## Beispiel: vollstaendige V1-Datei

```json
{
  "version": 1,
  "type": "phylax-backup",
  "created": "2026-04-20T15:30:00Z",
  "source": { "app": "phylax", "appVersion": "0.0.0" },
  "crypto": {
    "algorithm": "AES-256-GCM",
    "kdf": "PBKDF2-SHA256",
    "iterations": 1200000,
    "salt": "rAnDomSaLtBytEsBase64EnCod3dTo44Ch4r5HereInTheStrnG="
  },
  "data": "BaSe64EncodedIVAndCipherTextAndAuthTagConcatenatedTogetherAsOneBase64String=="
}
```

Der Inhalt ist repraesentativ, nicht echt. Reale Backups sind viele
Kilobyte bis Megabyte gross, je nach Profil-Umfang.
