# Vendor-Bibliotheken

Diese Verzeichnis enthaelt unveraenderte Drittanbieter-Bibliotheken als
Vendoring. Vorteile gegenueber CDN-Einbindung:

- Funktioniert offline (Pi muss nicht zwingend Internet haben)
- Versionen sind reproduzierbar und ueber `git` versioniert
- Keine externen Punkte fuer Latenz oder Ausfall im LAN

## Inhalt

| Datei | Version | Lizenz | Quelle | SHA-256 |
|---|---|---|---|---|
| `Sortable.min.js`    | 1.15.2 | MIT | `https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js` | `ca68430703c4f5960e90735867c6e94d29b5a3de37107d8100e5a301007e9e6e` |
| `gridstack-all.js`   | 12.6.0 | MIT | `https://cdn.jsdelivr.net/npm/gridstack@12.6.0/dist/gridstack-all.js` | `c1f635eb7e06cd07564c69b8a62bb6807ed69e0f68c80c93d2205a2158158949` |
| `gridstack.min.css`  | 12.6.0 | MIT | `https://cdn.jsdelivr.net/npm/gridstack@12.6.0/dist/gridstack.min.css` | `f600e9f9cbc040d2974a5da1fa41b3cf2b5d03b4868c4f26f6a60175f2974d58` |

## Aktualisieren

```bash
# Beispiel SortableJS:
curl -sL -o public/assets/vendor/Sortable.min.js \
  "https://cdn.jsdelivr.net/npm/sortablejs@<version>/Sortable.min.js"

# Beispiel GridStack:
curl -sL -o public/assets/vendor/gridstack-all.js \
  "https://cdn.jsdelivr.net/npm/gridstack@<version>/dist/gridstack-all.js"
curl -sL -o public/assets/vendor/gridstack.min.css \
  "https://cdn.jsdelivr.net/npm/gridstack@<version>/dist/gridstack.min.css"

# Pruefsummen aktualisieren:
shasum -a 256 public/assets/vendor/*.{js,css}
```

Anschliessend die Tabelle oben aktualisieren und committen.
