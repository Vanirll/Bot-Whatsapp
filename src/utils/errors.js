function getReadableError(error) {
    const toText = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Buffer.isBuffer(value)) return value.toString('utf8');
        if (Array.isArray(value)) return value.map((item) => toText(item)).join('\n').trim();

        if (typeof value === 'object') {
            const nested = value.stderr || value.stdout || value.message;
            if (nested && nested !== value) return toText(nested);

            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }

        return String(value);
    };

    const raw = toText(error).trim();
    if (!raw) return 'No se pudo descargar el enlace.';

    const compact = raw.replace(/\s+/g, ' ');

    if (/FFMPEG_NOT_AVAILABLE/i.test(compact)) {
        return 'No se encontró FFmpeg para convertir el video. Ejecuta npm install y reinicia el bot.';
    }

    if (/FFMPEG_CONVERSION_FAILED/i.test(compact)) {
        return 'No se pudo convertir el archivo a formato compatible de WhatsApp.';
    }

    if (/^t$/i.test(compact) || /evaluation failed:\s*t/i.test(compact)) {
        return 'WhatsApp rechazó el envío del video en ese formato. Intenta nuevamente; el bot aplicará envío alternativo.';
    }

    if (/ffmpeg/i.test(compact) && /(not found|no such file|unrecognized|enoent)/i.test(compact)) {
        return 'Falta FFmpeg en el sistema. Instálalo y vuelve a intentar.';
    }

    if (/requested format is not available/i.test(compact)) {
        return 'Ese enlace no ofrece el formato de video esperado. Probé un formato alternativo, pero tampoco estuvo disponible.';
    }

    if (/(private|deleted|removed|forbidden|403|not available)/i.test(compact)) {
        return 'El contenido está privado, eliminado o no disponible para descarga.';
    }

    return compact.slice(0, 300);
}

module.exports = {
    getReadableError
};
