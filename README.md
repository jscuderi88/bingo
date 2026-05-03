# Bingo · Consultora Natura & Belleza

Aplicación standalone de bingo para uso casero/eventos. HTML/CSS/JS vanilla, sin build, deploy directo en Vercel como sitio estático.

## Features

- **Configurador inicial**:
  - Cantidad de números (del 1 al N)
  - Repetición sí/no
  - Cantidad de veces que debe salir un número para ganar
  - Modo de etiqueta del cartón (solo números / nombre + número / solo nombre)
  - Columnas del tablero
  - Asignación de nombres a cada número (comprador del cartón)
- **Pantalla de juego**:
  - Bola gigante con animación de sorteo (tumble + reveal)
  - Tablero con todos los números, contador `X/N` y nombre del comprador
  - Historial completo de bolas sorteadas
  - Detección automática de ganador + confeti + fanfare
  - Auto-sortear con velocidad configurable
  - Pantalla completa, sonido on/off, reset
  - Persistencia automática en localStorage (no perdés la partida si recargás)

## Estructura

```
.
├── index.html       Layout
├── styles.css       Branding cream + rose terracota
├── app.js           Lógica del juego
└── assets/
    └── logo.jpg     Logo Consultora Natura & Belleza
```

## Deploy

Vercel detecta automáticamente como static site. Solo hay que conectar el repo:

```bash
# Opción 1: vía Vercel CLI
vercel --prod

# Opción 2: conectarlo desde vercel.com → Import Project
```

## Desarrollo local

Abrí `index.html` en cualquier browser. No necesita servidor.

```bash
# Opcional, si querés un server con auto-reload:
python3 -m http.server 8000
# o
npx serve .
```
