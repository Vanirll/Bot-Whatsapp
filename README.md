# Bot de WhatsApp para descargar videos

Este bot recibe un enlace por WhatsApp y responde con el video descargado cuando el dominio es compatible:

- TikTok
- Instagram
- YouTube
- Facebook
- Twitter/X
- Reddit

## Requisitos

- Node.js 18+
- Google Chrome/Chromium instalado (usado por `whatsapp-web.js`)
- FFmpeg recomendado (algunas plataformas lo requieren para unir audio/video)

## Instalación

```bash
npm install
```

## Configuración

1. Crea tu archivo de entorno:

```bash
copy .env.example .env
```

2. (Opcional) Ajusta:

- `MAX_FILE_SIZE_MB` (por defecto `60`)
- `MAX_CONCURRENT_DOWNLOADS` (por defecto `1`; recomendado para bajo consumo de RAM)
- `FFMPEG_MAX_BUFFER_MB` (por defecto `4`; controla RAM usada por ffmpeg)
- `SESSION_PATH` (por defecto `.session`)
- `ALLOW_DOCUMENT_FALLBACK` (por defecto `false`; si es `true`, al fallar video lo envía como documento)
- `KEEP_DOWNLOADED_FILES` (por defecto `false`; si es `true`, guarda videos en `temp/`)

## Ejecutar

```bash
npm start
```

Al iniciar, aparecerá un QR en consola. Escanéalo desde WhatsApp (Dispositivos vinculados).

> La primera vez, el bot descargará automáticamente `yt-dlp` en la carpeta `bin/`.

## Uso

Envía un mensaje que contenga un enlace compatible en cualquier chat donde esté tu cuenta vinculada al bot.

## Notas

- Si una plataforma requiere cookies/sesión o bloquea el contenido, la descarga puede fallar.
- Algunos videos pueden exceder el límite permitido por WhatsApp.
- Usa este bot solo con contenido permitido por términos de servicio y legislación aplicable.

## Optimización de RAM

- El bot ahora evita múltiples instancias al mismo tiempo para no duplicar procesos de Chrome.
- Si notas alto consumo, verifica en el Administrador de tareas que solo exista un proceso de `node` del bot.
- Para equipos modestos, mantén `MAX_CONCURRENT_DOWNLOADS=1` y `MAX_FILE_SIZE_MB` entre `30` y `60`.
