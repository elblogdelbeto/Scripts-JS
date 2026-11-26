// Pegar en la consola (F12 > Console) con el visor ABIERTO en el primer elemento.
// Recorre el visor (PhotoSwipe) pulsando "Next" y descarga imágenes (tamaño completo)
// y videos .mp4 (calidad "original" o la más alta disponible).
// Los nombres empiezan con la fecha de la publicación: 2026-11-11_2107_nombre.jpg
(async () => {
  const MAX = 500;          // límite de seguridad
  const ESPERA_MS = 1500;   // tiempo para que cargue cada elemento
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Ordena calidades: original > 1080 > 720 > 480 > 240 ...
  const rango = label => {
    if (!label) return 0;
    if (/original|source/i.test(label)) return 99999;
    return parseInt(label, 10) || 1;
  };

  const elementoActual = () => {
    const slide = document.querySelector('.pswp__item[aria-hidden="false"]');
    if (!slide) return null;

    const video = slide.querySelector('video');
    if (video) {
      const fuentes = [...video.querySelectorAll('source')]
        .map(s => ({ url: s.src, label: s.getAttribute('label') || '' }))
        .filter(s => s.url);
      if (!fuentes.length && (video.currentSrc || video.src)) {
        fuentes.push({ url: video.currentSrc || video.src, label: '' });
      }
      fuentes.sort((a, b) => rango(b.label) - rango(a.label));
      if (fuentes.length) return { tipo: 'video', url: fuentes[0].url, label: fuentes[0].label };
    }

    const img = slide.querySelector('.pswp__img img, img.pswp__img');
    if (img && (img.currentSrc || img.src)) return { tipo: 'imagen', url: img.currentSrc || img.src };
    return null;
  };

  // --- Fecha de la publicación (arriba a la derecha del visor, ej. "Nov 11, 9:07 pm") ---
  const MESES = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
                  ene:1, abr:4, ago:8, dic:12 };
  const dos = n => String(n).padStart(2, '0');

  const fechaActual = () => {
    const el = document.querySelector('.pswp__header-controls.m-right-column [title]')
            || document.querySelector('.pswp__header [title]');
    if (!el) return null;
    // El title trae la hora ("Mar 28, 1:53 am") y el texto visible trae el año
    // en publicaciones antiguas ("Mar 28, 2023"). Se leen los dos y se combinan.
    const RE = /([A-Za-z]{3})[a-z.]*\s+(\d{1,2})(?:,\s*(\d{4}))?(?:,?\s*(\d{1,2}):(\d{2})\s*([ap]\.?\s*m\.?)?)?/i;
    const mt = (el.getAttribute('title') || '').match(RE);
    const mx = (el.textContent || '').match(RE);
    const m = mt || mx;
    if (!m) return null;
    if (!m[3] && mx && mx[3]) m[3] = mx[3];   // año del texto visible
    if (!m[4] && mx && mx[4]) { m[4] = mx[4]; m[5] = mx[5]; m[6] = mx[6]; }
    const mes = MESES[m[1].toLowerCase()];
    if (!mes) return null;
    const dia = +m[2];
    let anio = m[3] ? +m[3] : new Date().getFullYear();
    // Sin año = año actual; si esa fecha quedaría en el futuro, es del año pasado
    if (!m[3] && new Date(anio, mes - 1, dia) > new Date()) anio--;
    let fecha = `${anio}-${dos(mes)}-${dos(dia)}`;
    if (m[4]) {
      let h = +m[4];
      const ampm = (m[6] || '').toLowerCase().replace(/[.\s]/g, '');
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      fecha += `_${dos(h)}${m[5]}`;
    }
    return fecha;
  };

  const nombreDe = (url, n, tipo, fecha) => {
    const base = url.split('?')[0].split('/').pop() || `${tipo}_${n}.${tipo === 'video' ? 'mp4' : 'jpg'}`;
    return fecha ? `${fecha}_${base}` : `sin-fecha_${base}`;
  };

  const guardarBlob = (blob, nombre) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };

  const descargar = async (item, n) => {
    const nombre = nombreDe(item.url, n, item.tipo, item.fecha);
    const resp = await fetch(item.url, { mode: 'cors', credentials: 'omit' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    guardarBlob(await resp.blob(), nombre);
    return nombre;
  };

  const vistas = new Set();
  const fallidas = [];
  let sinCambio = 0, nImg = 0, nVid = 0;

  for (let i = 1; i <= MAX; i++) {
    await sleep(ESPERA_MS);
    const item = elementoActual();

    if (!item) {
      console.log(`#${i}: no se encontró imagen ni video, se salta`);
    } else if (vistas.has(item.url)) {
      if (++sinCambio >= 2) { console.log('Se repitió el elemento: fin de la galería.'); break; }
    } else {
      sinCambio = 0;
      vistas.add(item.url);
      item.fecha = fechaActual();
      const etiqueta = item.tipo === 'video' ? `video (${item.label || '?'})` : 'imagen';
      try {
        if (item.tipo === 'video') console.log(`#${vistas.size} bajando ${etiqueta}... (puede tardar)`);
        const nombre = await descargar(item, vistas.size);
        item.tipo === 'video' ? nVid++ : nImg++;
        console.log(`#${vistas.size} OK ${etiqueta} ${nombre}`);
      } catch (e) {
        fallidas.push(item.url);
        console.warn(`#${vistas.size} falló ${etiqueta}`, e);
      }
    }

    const next = document.querySelector('.pswp__button--arrow--next');
    if (!next || next.disabled || getComputedStyle(next).display === 'none') {
      console.log('No hay botón "Next": fin de la galería.');
      break;
    }
    // Pausar el video actual para que no siga consumiendo datos
    document.querySelectorAll('.pswp__item video').forEach(v => { try { v.pause(); } catch {} });
    next.click();
  }

  console.log(`Terminado: ${nImg} imágenes y ${nVid} videos descargados.`);

  // Si algo falló (p. ej. por CORS), guarda la lista de enlaces para bajarlos aparte.
  if (fallidas.length) {
    guardarBlob(new Blob([fallidas.join('\n')], { type: 'text/plain' }), 'fallidas.txt');
    console.warn(`${fallidas.length} fallaron. Se guardó "fallidas.txt" con sus enlaces (caducan en unas horas).`);
  }
})();
