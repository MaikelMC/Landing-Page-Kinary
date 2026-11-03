/* Vídeo animado de la Oficina Kynari: 7 escenas con subtítulos, en español o inglés según <html lang>.
   Todo es de ejemplo (un café inventado con dos socios). Se usa en oficina.html y en/office.html. */
(function () {
  const raiz = document.getElementById('demo');
  if (!raiz) return;
  const en = document.documentElement.lang.startsWith('en');
  const DURACION = 8000;

  const archivo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>';
  const T = en ? {
    url: 'office.cafelaesquina.example',
    escenas: [
      { cap: 'A private office online: only the partners get in. Any other email is blocked automatically.',
        html: `<h3>Only <em>you two</em> get in</h3>
          <div class="d-card d-col" style="max-width:calc(52 * var(--u))">
            <div class="d-muted pop" style="--d:.2s">Office · Café La Esquina (example)</div>
            <div class="d-row pop" style="--d:.8s"><span class="d-avatar">AN</span>ana@example.com<span class="d-chip ok" style="margin-left:auto">✓ Partner</span></div>
            <div class="d-row pop" style="--d:1.6s"><span class="d-avatar">LU</span>luis@example.com<span class="d-chip ok" style="margin-left:auto">✓ Partner</span></div>
            <div class="d-row pop" style="--d:3s"><span class="d-avatar" style="background:rgba(214,69,69,.15);color:#f08a8a">?</span>stranger@mail.com<span class="d-chip bad" style="margin-left:auto">✕ Blocked</span></div>
            <div class="d-muted pop d-solo-pc" style="--d:4.2s;font-size:calc(1.3 * var(--u))">Each device stays signed in · «Sign out everywhere» if a phone is lost</div>
          </div>` },
      { cap: 'Upload an invoice, pick its type and who can read it: only you two, only the AI that reviews it, or everyone.',
        html: `<h3>Upload and choose <em>who can read it</em></h3>
          <div class="d-two">
            <div class="d-card d-col">
              <div class="d-file pop" style="--d:.3s">${archivo}<b>power-bill-nov.pdf</b></div>
              <div class="d-row pop" style="--d:1s"><span class="d-chip gold">Invoice</span><span class="d-chip">Contract</span><span class="d-chip">Legal</span><span class="d-chip">Plan</span></div>
              <div class="d-row pop d-mono" style="--d:1.8s">1,250.00 CUP <span class="d-muted">· rate 1 USD = 400 CUP</span></div>
              <div class="d-row pop" style="--d:2.4s"><span class="d-muted">Paid by</span> Luis · <span class="d-muted">Project</span> Café</div>
            </div>
            <div class="d-col">
              <div class="d-card pop" style="--d:3s"><span class="d-chip purple">🔒 Only us</span><div class="d-muted" style="margin-top:.6cqw">No AI ever reads it.</div></div>
              <div class="d-card pop" style="--d:3.6s;border-color:var(--accent)"><span class="d-chip gold">🔒 Private</span><div class="d-muted" style="margin-top:.6cqw">Only the reviewing AI. The chat sees a safe summary.</div></div>
              <div class="d-card pop" style="--d:4.2s"><span class="d-chip">Normal</span><div class="d-muted" style="margin-top:.6cqw">The chat can read it.</div></div>
            </div>
          </div>` },
      { cap: 'Every morning an AI assistant reviews what is new, files it by month and flags any amount that does not match.',
        html: `<h3>It <em>files itself</em></h3>
          <div class="d-two">
            <div class="d-card d-tree">
              <div>Invoices<span class="n">14</span></div>
              <div class="sub">October 2026<span class="n">9</span></div>
              <div class="sub hot pop" style="--d:1.6s">November 2026<span class="n">5</span></div>
              <div>Income<span class="n">6</span></div><div class="d-solo-pc">Contracts<span class="n">3</span></div><div class="d-solo-pc">Legal<span class="n">2</span></div><div class="d-solo-pc">Plans<span class="n">4</span></div>
            </div>
            <div class="d-col">
              <div class="d-card d-file d-fly" style="--d:.4s">${archivo}<b>power-bill-nov.pdf</b><span class="d-chip gold" style="margin-left:auto">→ Nov</span></div>
              <div class="d-card pop" style="--d:2.4s"><span class="d-chip ok">✓ Reviewed by AI</span><div class="d-muted" style="margin-top:.8cqw">Safe summary: café power bill, November, 1,250 CUP.</div></div>
              <div class="d-card pop" style="--d:4s;border-color:#d64545"><span class="d-chip bad">Note</span><div class="d-muted" style="margin-top:.8cqw">«The water bill says 900 CUP, but 990 was typed.»</div></div>
            </div>
          </div>` },
      { cap: 'A monthly summary in every currency as uploaded, with an approximate total and whether the business already covers its costs.',
        html: `<h3>Every currency, <em>one summary</em></h3>
          <div class="d-two">
            <div class="d-card">
              <table class="d-table">
                <tr class="pop" style="--d:.4s"><td>USD</td><td>120.00 USD</td></tr>
                <tr class="pop" style="--d:.8s"><td>CAD</td><td>35.00 CAD</td></tr>
                <tr class="pop" style="--d:1.2s"><td>CUP</td><td>18,500 CUP</td></tr>
                <tr class="total pop" style="--d:1.8s"><td>Expenses ≈</td><td>212.00 USD</td></tr>
              </table>
            </div>
            <div class="d-card pop" style="--d:2.4s">
              <div>Income covers <b style="color:#6fd08a">64 %</b> of expenses</div>
              <div class="d-meter"><span style="--w:64%;--d:2.8s"></span></div>
              <div class="d-muted d-solo-pc" style="font-size:calc(1.3 * var(--u))">By project · official exchange rate of the day · your own rate for CUP</div>
            </div>
          </div>` },
      { cap: 'Ask anything. The chat only sees what you allow — never anything marked «Only us».',
        html: `<h3>Just <em>ask</em></h3>
          <div class="d-col" style="max-width:calc(62 * var(--u));margin:0 auto">
            <div class="d-msg me pop" style="--d:.4s">How much did we spend on power this year?</div>
            <div class="d-msg ai pop d-typing" style="--d:2.4s"><span class="d-dots"><i></i><i></i><i></i></span></div>
            <div class="d-msg ai pop" style="--d:2.5s">9 power bills in 2026: <b>11,300 CUP</b> in total. The highest was August.</div>
            <div class="d-msg me pop" style="--d:4.6s">What deadlines do we have?</div>
            <div class="d-msg ai pop" style="--d:5.6s">Shop licence renewal: <b>in 3 days</b>.</div>
          </div>` },
      { cap: 'Email alerts: what the other partner uploads, comments, deadlines and the AI review.',
        html: `<h3>Nothing <em>slips by</em></h3>
          <div class="d-col" style="max-width:calc(60 * var(--u))">
            <div class="d-card d-row pop" style="--d:.4s"><span class="d-avatar">LU</span><div>Luis uploaded «Lease contract»<div class="d-muted" style="font-size:calc(1.3 * var(--u))">email · 9:14</div></div></div>
            <div class="d-card d-row pop" style="--d:1.4s"><span class="d-avatar">AN</span><div>Ana commented on «Power bill November»<div class="d-muted" style="font-size:calc(1.3 * var(--u))">email · 10:02</div></div></div>
            <div class="d-card d-row pop" style="--d:2.4s;border-color:var(--accent)"><span class="d-chip gold">⏰</span><div>Deadline: licence renewal — in 3 days<div class="d-muted" style="font-size:calc(1.3 * var(--u))">email to both · 7:00</div></div></div>
            <div class="d-card d-row pop" style="--d:3.4s"><span class="d-chip ok">AI</span><div>4 documents reviewed, 1 note<div class="d-muted" style="font-size:calc(1.3 * var(--u))">email to both · 6:30</div></div></div>
          </div>` },
      { cap: 'We tailor it to your business: your documents, your currencies, your people.',
        html: `<div class="d-cta">
            <h3 class="pop" style="--d:.2s">We set it up <em>for your business</em></h3>
            <div class="d-steps">
              <div class="pop" style="--d:1s"><b>1</b>We talk: documents, currencies and who gets in.</div>
              <div class="pop" style="--d:1.8s"><b>2</b>We install it with your emails and your folders.</div>
              <div class="pop" style="--d:2.6s"><b>3</b>We show you how and review it with you the first month.</div>
            </div>
            <div class="pop d-mono" style="--d:3.4s;color:var(--accent)">kynari.dev</div>
          </div>` },
    ],
  } : {
    url: 'oficina.cafelaesquina.ejemplo',
    escenas: [
      { cap: 'Una oficina privada en internet: solo entran los socios. Cualquier otro correo queda bloqueado solo.',
        html: `<h3>Solo entran <em>ustedes</em></h3>
          <div class="d-card d-col" style="max-width:calc(52 * var(--u))">
            <div class="d-muted pop" style="--d:.2s">Oficina · Café La Esquina (ejemplo)</div>
            <div class="d-row pop" style="--d:.8s"><span class="d-avatar">AN</span>ana@ejemplo.com<span class="d-chip ok" style="margin-left:auto">✓ Socia</span></div>
            <div class="d-row pop" style="--d:1.6s"><span class="d-avatar">LU</span>luis@ejemplo.com<span class="d-chip ok" style="margin-left:auto">✓ Socio</span></div>
            <div class="d-row pop" style="--d:3s"><span class="d-avatar" style="background:rgba(214,69,69,.15);color:#f08a8a">?</span>desconocido@correo.com<span class="d-chip bad" style="margin-left:auto">✕ Bloqueado</span></div>
            <div class="d-muted pop d-solo-pc" style="--d:4.2s;font-size:calc(1.3 * var(--u))">La sesión queda abierta en cada dispositivo · «Cerrar en todos» si se pierde un teléfono</div>
          </div>` },
      { cap: 'Subes una factura, eliges el tipo y quién la puede leer: solo ustedes, solo la IA que revisa, o todos.',
        html: `<h3>Subes y eliges <em>quién lo lee</em></h3>
          <div class="d-two">
            <div class="d-card d-col">
              <div class="d-file pop" style="--d:.3s">${archivo}<b>factura-luz-nov.pdf</b></div>
              <div class="d-row pop" style="--d:1s"><span class="d-chip gold">Factura</span><span class="d-chip">Contrato</span><span class="d-chip">Legal</span><span class="d-chip">Plan</span></div>
              <div class="d-row pop d-mono" style="--d:1.8s">1.250,00 CUP <span class="d-muted">· tasa 1 USD = 400 CUP</span></div>
              <div class="d-row pop" style="--d:2.4s"><span class="d-muted">Pagó</span> Luis · <span class="d-muted">Proyecto</span> Café</div>
            </div>
            <div class="d-col">
              <div class="d-card pop" style="--d:3s"><span class="d-chip purple">🔒 Solo nosotros</span><div class="d-muted" style="margin-top:.6cqw">Ninguna IA lo lee nunca.</div></div>
              <div class="d-card pop" style="--d:3.6s;border-color:var(--accent)"><span class="d-chip gold">🔒 Privado</span><div class="d-muted" style="margin-top:.6cqw">Solo la IA que revisa. El chat ve un resumen seguro.</div></div>
              <div class="d-card pop" style="--d:4.2s"><span class="d-chip">Normal</span><div class="d-muted" style="margin-top:.6cqw">El chat lo puede leer.</div></div>
            </div>
          </div>` },
      { cap: 'Cada mañana un asistente de IA revisa lo nuevo, lo ordena por mes y avisa si un importe no cuadra.',
        html: `<h3>Se <em>ordena solo</em></h3>
          <div class="d-two">
            <div class="d-card d-tree">
              <div>Facturas<span class="n">14</span></div>
              <div class="sub">Octubre 2026<span class="n">9</span></div>
              <div class="sub hot pop" style="--d:1.6s">Noviembre 2026<span class="n">5</span></div>
              <div>Ingresos<span class="n">6</span></div><div class="d-solo-pc">Contratos<span class="n">3</span></div><div class="d-solo-pc">Legal<span class="n">2</span></div><div class="d-solo-pc">Planes<span class="n">4</span></div>
            </div>
            <div class="d-col">
              <div class="d-card d-file d-fly" style="--d:.4s">${archivo}<b>factura-luz-nov.pdf</b><span class="d-chip gold" style="margin-left:auto">→ Nov</span></div>
              <div class="d-card pop" style="--d:2.4s"><span class="d-chip ok">✓ Revisado por la IA</span><div class="d-muted" style="margin-top:.8cqw">Resumen seguro: factura de luz del café, noviembre, 1.250 CUP.</div></div>
              <div class="d-card pop" style="--d:4s;border-color:#d64545"><span class="d-chip bad">Nota</span><div class="d-muted" style="margin-top:.8cqw">«La del agua dice 900 CUP, pero se escribió 990.»</div></div>
            </div>
          </div>` },
      { cap: 'Resumen del mes en cada moneda tal como se subió, con el total aproximado y si el negocio ya cubre sus gastos.',
        html: `<h3>Varias monedas, <em>un resumen</em></h3>
          <div class="d-two">
            <div class="d-card">
              <table class="d-table">
                <tr class="pop" style="--d:.4s"><td>USD</td><td>120,00 USD</td></tr>
                <tr class="pop" style="--d:.8s"><td>CAD</td><td>35,00 CAD</td></tr>
                <tr class="pop" style="--d:1.2s"><td>CUP</td><td>18.500 CUP</td></tr>
                <tr class="total pop" style="--d:1.8s"><td>Gastos ≈</td><td>212,00 USD</td></tr>
              </table>
            </div>
            <div class="d-card pop" style="--d:2.4s">
              <div>Los ingresos cubren el <b style="color:#6fd08a">64 %</b> de los gastos</div>
              <div class="d-meter"><span style="--w:64%;--d:2.8s"></span></div>
              <div class="d-muted d-solo-pc" style="font-size:calc(1.3 * var(--u))">Por proyecto · cambio oficial del día · tu propia tasa para el CUP</div>
            </div>
          </div>` },
      { cap: 'Pregunta lo que necesites. El chat solo ve lo permitido: nunca lo marcado «Solo nosotros».',
        html: `<h3>Solo <em>pregunta</em></h3>
          <div class="d-col" style="max-width:calc(62 * var(--u));margin:0 auto">
            <div class="d-msg me pop" style="--d:.4s">¿Cuánto gastamos en luz este año?</div>
            <div class="d-msg ai pop d-typing" style="--d:2.4s"><span class="d-dots"><i></i><i></i><i></i></span></div>
            <div class="d-msg ai pop" style="--d:2.5s">En 2026 van 9 facturas de luz: <b>11.300 CUP</b> en total. La más alta fue la de agosto.</div>
            <div class="d-msg me pop" style="--d:4.6s">¿Qué fechas límite tenemos?</div>
            <div class="d-msg ai pop" style="--d:5.6s">Renovar la licencia del local: <b>en 3 días</b>.</div>
          </div>` },
      { cap: 'Avisos por correo: lo que sube el otro socio, los comentarios, las fechas límite y la revisión de la IA.',
        html: `<h3>No se te <em>escapa nada</em></h3>
          <div class="d-col" style="max-width:calc(60 * var(--u))">
            <div class="d-card d-row pop" style="--d:.4s"><span class="d-avatar">LU</span><div>Luis subió «Contrato de alquiler»<div class="d-muted" style="font-size:calc(1.3 * var(--u))">correo · 9:14</div></div></div>
            <div class="d-card d-row pop" style="--d:1.4s"><span class="d-avatar">AN</span><div>Ana comentó «Factura de luz noviembre»<div class="d-muted" style="font-size:calc(1.3 * var(--u))">correo · 10:02</div></div></div>
            <div class="d-card d-row pop" style="--d:2.4s;border-color:var(--accent)"><span class="d-chip gold">⏰</span><div>Fecha límite: renovar la licencia — en 3 días<div class="d-muted" style="font-size:calc(1.3 * var(--u))">correo a los dos · 7:00</div></div></div>
            <div class="d-card d-row pop" style="--d:3.4s"><span class="d-chip ok">IA</span><div>Revisó 4 documentos y dejó 1 nota<div class="d-muted" style="font-size:calc(1.3 * var(--u))">correo a los dos · 6:30</div></div></div>
          </div>` },
      { cap: 'La adaptamos a tu negocio: tus documentos, tus monedas y tu gente.',
        html: `<div class="d-cta">
            <h3 class="pop" style="--d:.2s">Te la montamos <em>para tu negocio</em></h3>
            <div class="d-steps">
              <div class="pop" style="--d:1s"><b>1</b>Hablamos: documentos, monedas y quién entra.</div>
              <div class="pop" style="--d:1.8s"><b>2</b>La instalamos con tus correos y tus carpetas.</div>
              <div class="pop" style="--d:2.6s"><b>3</b>Te enseñamos y la revisamos contigo el primer mes.</div>
            </div>
            <div class="pop d-mono" style="--d:3.4s;color:var(--accent)">kynari.dev</div>
          </div>` },
    ],
  };

  const iconoPlay = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
  const iconoPausa = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  const iconoOtraVez = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  const etiquetas = en
    ? { play: 'Play', pausa: 'Pause', otra: 'Watch again', escena: 'Scene', nota: 'Demo with made-up data.' }
    : { play: 'Reproducir', pausa: 'Pausar', otra: 'Ver otra vez', escena: 'Escena', nota: 'Demostración con datos inventados.' };

  raiz.innerHTML = `
    <div class="demo-stage" role="img" aria-label="${en ? 'Animated demo of Oficina Kynari' : 'Vídeo animado de la Oficina Kynari'}">
      <div class="demo-win"><div class="demo-bar"><i></i><i></i><i></i><span>${T.url}</span></div>
        ${T.escenas.map((e, i) => `<div class="demo-scene" data-i="${i}">${e.html}</div>`).join('')}
      </div>
    </div>
    <p class="demo-caption" aria-live="polite"></p>
    <div class="demo-controls">
      <button class="demo-play" type="button"></button>
      <div class="demo-segs">${T.escenas.map((_, i) => `<button class="demo-seg" type="button" aria-label="${etiquetas.escena} ${i + 1}"><span></span></button>`).join('')}</div>
    </div>
    <p class="demo-note">${etiquetas.nota}</p>`;

  const escenas = [...raiz.querySelectorAll('.demo-scene')];
  const segs = [...raiz.querySelectorAll('.demo-seg span')];
  const caption = raiz.querySelector('.demo-caption');
  const boton = raiz.querySelector('.demo-play');
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = 0, inicio = 0, pausadoEn = 0, tocando = false, fin = false, frame = 0;

  function mostrar(i) {
    actual = i;
    escenas.forEach((e, j) => {
      e.classList.remove('on');
      if (j === i) { void e.offsetWidth; e.classList.add('on'); } // reinicia sus animaciones
    });
    segs.forEach((s, j) => { s.style.width = j < i ? '100%' : '0'; });
    caption.textContent = T.escenas[i].cap;
  }
  function pintarBoton() {
    boton.innerHTML = fin ? iconoOtraVez : (tocando ? iconoPausa : iconoPlay);
    boton.setAttribute('aria-label', fin ? etiquetas.otra : (tocando ? etiquetas.pausa : etiquetas.play));
  }
  function paso(t) {
    if (!tocando) return;
    const pasado = t - inicio;
    segs[actual].style.width = Math.min(100, pasado / DURACION * 100) + '%';
    if (pasado >= DURACION) {
      if (actual === escenas.length - 1) { tocando = false; fin = true; pintarBoton(); return; }
      mostrar(actual + 1);
      inicio = t;
    }
    frame = requestAnimationFrame(paso);
  }
  function play() {
    if (fin) { fin = false; mostrar(0); pausadoEn = 0; }
    tocando = true;
    escenas[actual].querySelectorAll('*').forEach(el => { el.style.animationPlayState = ''; });
    inicio = performance.now() - pausadoEn;
    pintarBoton();
    frame = requestAnimationFrame(paso);
  }
  function pausa() {
    tocando = false;
    cancelAnimationFrame(frame);
    pausadoEn = performance.now() - inicio;
    escenas[actual].querySelectorAll('*').forEach(el => { el.style.animationPlayState = 'paused'; });
    pintarBoton();
  }
  boton.addEventListener('click', () => (tocando ? pausa() : play()));
  raiz.querySelectorAll('.demo-seg').forEach((s, i) => s.addEventListener('click', () => {
    fin = false;
    mostrar(i);
    pausadoEn = 0;
    inicio = performance.now();
    if (quieto) { pintarBoton(); return; }
    if (!tocando) play();
  }));

  mostrar(0);
  pintarBoton();
  // Empieza solo cuando se ve en pantalla (salvo si la persona pidió menos movimiento).
  if (!quieto && 'IntersectionObserver' in window) {
    const ojo = new IntersectionObserver((es) => {
      if (es.some(e => e.isIntersecting)) { ojo.disconnect(); mostrar(0); play(); }
    }, { threshold: 0.4 });
    ojo.observe(raiz);
  }
})();
