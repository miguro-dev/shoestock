/**
 * logica-registro-calzado.js
 * Formulario modal de registro de calzado (3 niveles: producto → variante → item)
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Rango visible por defecto (chips mostrados sin expandir).
 * Cambiar estos valores para ajustar el rango inicial.
 */
const VISIBLE_MIN = 35;
const VISIBLE_MAX = 44;

/**
 * Rango completo (visible al expandir con "Ver más tallas").
 * La media talla del máximo (FULL_MAX + 0.5) no se ofrece.
 */
const FULL_MIN = 20;
const FULL_MAX = 45;

/** Array de todos los números enteros del rango completo. */
const TALLAS_ENTERAS = Array.from({ length: FULL_MAX - FULL_MIN + 1 }, (_, i) => i + FULL_MIN);

const CATEGORIAS = [
    { id: 1, nombre: 'Deportivo' },
    { id: 2, nombre: 'Casual' },
    { id: 3, nombre: 'Formal' },
    { id: 4, nombre: 'Sandalia' },
    { id: 5, nombre: 'Bota' },
    { id: 6, nombre: 'Infantil' },
];

// ─── Estado del formulario ────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id: string,
 *   color: string,
 *   imageFile: File|null,
 *   imagePreview: string|null,
 *   sizes: Record<string, { stock: string, buy: string, sell: string, barcode: string }>
 * }} Variante
 *
 * @typedef {{
 *   name: string,
 *   categoryId: number|null,
 *   hasSizePricing: boolean,
 *   buy: string,
 *   sell: string,
 *   variants: Variante[]
 * }} EstadoFormulario
 */

/** @type {EstadoFormulario} */
let estado = crearEstadoInicial();

function crearEstadoInicial() {
    return {
        name: '',
        categoryId: null,
        hasSizePricing: false,
        buy: '',
        sell: '',
        variants: [crearVariante()],
    };
}

function crearVariante() {
    return {
        id: crypto.randomUUID(),
        color: '',
        imageFile: null,
        imagePreview: null,
        sizes: {},
        _expandido: false,
    };
}

// ─── Generación de códigos de barra (EAN-13 simulado) ──────────────────────

/**
 * Genera un EAN-13 válido (12 dígitos aleatorios + dígito de control).
 * @returns {string}
 */
function generarEAN13() {
    const digitos = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const suma = digitos.reduce((acc, d, i) => acc + (i % 2 === 0 ? d : d * 3), 0);
    const control = (10 - (suma % 10)) % 10;
    return [...digitos, control].join('');
}

/** Devuelve un EAN-13 que no esté ya usado en el formulario. */
function generarCodigoUnico() {
    const usados = codigosEnUso();
    let codigo;
    do { codigo = generarEAN13(); } while (usados.has(codigo));
    return codigo;
}

/** Recoge todos los códigos de barras usados actualmente en el estado. */
function codigosEnUso() {
    const set = new Set();
    for (const v of estado.variants) {
        for (const item of Object.values(v.sizes)) {
            if (item.barcode) set.add(item.barcode);
        }
    }
    return set;
}

// ─── Formato de tallas ────────────────────────────────────────────────────────

/** Convierte el string canónico "36.5" a la etiqueta visual "36½". */
function etiquetaTalla(size) {
    if (String(size).endsWith('.5')) {
        return `${parseInt(size)}½`;
    }
    return String(size);
}

/** Ordena tallas numéricamente. */
function ordenarTallas(tallas) {
    return [...tallas].sort((a, b) => parseFloat(a) - parseFloat(b));
}

// ─── Referencias DOM ──────────────────────────────────────────────────────────

const overlay      = document.getElementById('modalCalzadoOverlay');
const btnCerrar    = document.getElementById('modalCalzadoCerrar');
const btnAbrir     = document.getElementById('btnAddProduct');
const toggleEl     = document.getElementById('togglePrecioPorTalla'); // <input type="checkbox">
const preciosUni   = document.getElementById('preciosUnicos');
const listaColores = document.getElementById('listaColores');
const btnAgrColor  = document.getElementById('btnAgregarColor');
const resumenEl    = document.getElementById('resumenFormulario');
const errListEl    = document.getElementById('listaErrores');
const errItemsEl   = document.getElementById('listaErroresItems');
const btnGuardar   = document.getElementById('btnGuardarCalzado');
const toastCont    = document.getElementById('toastContenedor');

// Mini-modal confirmación
const confirmOverlay  = document.getElementById('confirmOverlay');
const confirmCancelar = document.getElementById('confirmCancelar');
const confirmDescartar = document.getElementById('confirmDescartar');

// ─── Apertura / Cierre del modal ──────────────────────────────────────────────

let focusOrigen = null; // botón que abrió el modal, para devolver el foco

function abrirModal() {
    focusOrigen = document.activeElement;
    estado = crearEstadoInicial();
    renderTodo();
    overlay.classList.add('active');
    // Foco inicial en nombre del modelo
    requestAnimationFrame(() => {
        document.getElementById('modeloNombre')?.focus();
    });
    document.addEventListener('keydown', trampaFoco);
}

function pedirCierre() {
    if (formularioTieneDatos()) {
        confirmOverlay.classList.add('active');
        confirmDescartar.focus();
    } else {
        cerrarModal();
    }
}

function cerrarModal() {
    overlay.classList.remove('active');
    confirmOverlay.classList.remove('active');
    document.removeEventListener('keydown', trampaFoco);
    focusOrigen?.focus();
}

function formularioTieneDatos() {
    const nombre = document.getElementById('modeloNombre')?.value.trim();
    if (nombre) return true;
    for (const v of estado.variants) {
        if (v.color || Object.keys(v.sizes).length > 0) return true;
    }
    return false;
}

// ─── Trampa de foco (accesibilidad) ──────────────────────────────────────────

function trampaFoco(e) {
    if (e.key === 'Escape') {
        pedirCierre();
        return;
    }
    if (e.key !== 'Tab') return;

    // Seleccionar el modal visible más exterior
    const modalActivo = confirmOverlay.classList.contains('active') ? confirmOverlay : overlay;
    const focusables = [...modalActivo.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    )];

    if (focusables.length === 0) return;
    const primero = focusables[0];
    const ultimo  = focusables[focusables.length - 1];

    if (e.shiftKey) {
        if (document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
        }
    } else {
        if (document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    }
}

// ─── Toggle precio por talla ──────────────────────────────────────────────────

function actualizarToggle() {
    const on = estado.hasSizePricing;
    if (toggleEl) toggleEl.checked = on;
    preciosUni.style.display = on ? 'none' : 'flex';
}

// ─── Resumen del footer ───────────────────────────────────────────────────────

function actualizarResumen() {
    let totalTallas = 0;
    let totalPares  = 0;
    const colores   = estado.variants.length;
    for (const v of estado.variants) {
        const items = Object.values(v.sizes);
        totalTallas += items.length;
        totalPares  += items.reduce((s, i) => s + (parseInt(i.stock) || 0), 0);
    }
    resumenEl.innerHTML =
        `<strong>${colores}</strong> color${colores !== 1 ? 'es' : ''} · ` +
        `<strong>${totalTallas}</strong> talla${totalTallas !== 1 ? 's' : ''} · ` +
        `<strong>${totalPares}</strong> par${totalPares !== 1 ? 'es' : ''}`;
}

// ─── Render completo ──────────────────────────────────────────────────────────

function renderTodo() {
    // Sincronizar campos del modelo
    const inputNombre = document.getElementById('modeloNombre');
    const selCat      = document.getElementById('modeloCategoria');
    const inputBuy    = document.getElementById('precioCompraUnico');
    const inputSell   = document.getElementById('precioVentaUnico');

    if (inputNombre) inputNombre.value = estado.name;
    if (selCat)      selCat.value      = estado.categoryId ?? '';
    if (inputBuy)    inputBuy.value    = estado.buy;
    if (inputSell)   inputSell.value   = estado.sell;

    actualizarToggle();

    // Renderizar tarjetas de colores
    listaColores.innerHTML = '';
    for (const variante of estado.variants) {
        listaColores.appendChild(crearColorCard(variante));
    }

    ocultarErrores();
    actualizarResumen();
}

// ─── Tarjeta de color ─────────────────────────────────────────────────────────

function crearColorCard(variante) {
    const card = document.createElement('div');
    card.className = 'color-card';
    card.dataset.id = variante.id;

    card.innerHTML = `
        <div class="color-card-header">
            <!-- Foto -->
            <button type="button" class="color-foto-btn" aria-label="Subir foto del color"
                data-foto-btn="${variante.id}">
                ${variante.imagePreview
                    ? `<img src="${variante.imagePreview}" alt="Vista previa">`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round">
                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3L14.5 4z"/>
                            <circle cx="12" cy="13" r="3"/>
                        </svg>`}
            </button>
            <input type="file" accept="image/*" class="input-foto-color"
                id="foto-${variante.id}" data-variante-id="${variante.id}">

            <!-- Nombre del color -->
            <input type="text" class="color-nombre-input" placeholder="Nombre del color (ej: Negro / Rojo)"
                value="${variante.color}" aria-label="Nombre del color"
                data-nombre-color="${variante.id}">

            <!-- Acciones -->
            <div class="color-acciones">
                <button type="button" class="btn-icon-sm" title="Duplicar color"
                    aria-label="Duplicar color" data-duplicar="${variante.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <rect x="8" y="8" width="13" height="13" rx="2" ry="2"/>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                </button>
                <button type="button" class="btn-icon-sm peligro" title="Quitar color"
                    aria-label="Quitar color" data-quitar="${variante.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>

        <div class="color-card-body">
            ${renderSelectorTallas(variante)}
            ${renderTablaTallas(variante)}
        </div>
    `;

    adjuntarEventosCard(card, variante);
    return card;
}

// ─── Selector de tallas ───────────────────────────────────────────────────────

/**
 * Devuelve true si alguna talla del Set está fuera del rango visible (VISIBLE_MIN–VISIBLE_MAX).
 * En ese caso hay que mostrar las filas expandidas para que no queden tallas ocultas.
 * @param {Set<string>} tallasActivas
 */
function tieneTrallasForaDeRangoVisible(tallasActivas) {
    for (const key of tallasActivas) {
        const num = parseFloat(key);
        const entera = Math.floor(num);
        if (entera < VISIBLE_MIN || entera > VISIBLE_MAX) return true;
    }
    return false;
}

function renderSelectorTallas(variante) {
    const tallasActivas = new Set(Object.keys(variante.sizes));

    // Si hay tallas fuera del rango visible, expandir automáticamente.
    // También respeta el toggle manual (_expandido).
    const expandido = variante._expandido || tieneTrallasForaDeRangoVisible(tallasActivas);

    const rangoEnteras = TALLAS_ENTERAS.filter(t =>
        expandido ? true : (t >= VISIBLE_MIN && t <= VISIBLE_MAX)
    );
    // Las medias tallas del máximo completo (FULL_MAX + 0.5) no se ofrecen
    const rangoMedias = TALLAS_ENTERAS.filter(t =>
        expandido ? t < FULL_MAX : (t >= VISIBLE_MIN && t <= VISIBLE_MAX)
    );

    // Fila 1: chips de tallas enteras (siempre visibles, independientes)
    const chipsEnteras = rangoEnteras.map(t => {
        const key    = String(t);
        const active = tallasActivas.has(key);
        return `<button type="button" class="chip-talla"
            aria-pressed="${active}" data-chip="${key}" data-variante="${variante.id}"
            aria-label="Talla ${key}">${key}</button>`;
    }).join('');

    // Fila 2: chips de medias tallas (siempre visibles, completamente independientes)
    const chipsMedias = rangoMedias.map(t => {
        const key    = `${t}.5`;
        const active = tallasActivas.has(key);
        const label  = `Talla ${t} y medio`;
        return `<button type="button" class="chip-talla"
            aria-pressed="${active}" data-chip="${key}" data-variante="${variante.id}"
            aria-label="${label}">${etiquetaTalla(key)}</button>`;
    }).join('');

    // Botón expandir/contraer
    const btnVerMas = `<button type="button" class="btn-ver-mas-tallas" data-ver-mas="${variante.id}"
        aria-expanded="${expandido}">
        ${expandido ? 'Ver menos tallas' : 'Ver más tallas'}
    </button>`;

    // Controles de rango: selects con el rango completo
    const opcionesDesde = TALLAS_ENTERAS.map(t =>
        `<option value="${t}" ${t === VISIBLE_MIN ? 'selected' : ''}>${t}</option>`
    ).join('');
    const opcionesHasta = TALLAS_ENTERAS.map(t =>
        `<option value="${t}" ${t === VISIBLE_MAX ? 'selected' : ''}>${t}</option>`
    ).join('');

    return `
        <div class="tallas-selector" data-selector="${variante.id}">
            <div class="tallas-fila-grupo" role="group" aria-label="Tallas enteras">
                <span class="tallas-fila-etiqueta">Tallas enteras</span>
                <div class="tallas-grid">${chipsEnteras}</div>
            </div>
            <div class="tallas-fila-grupo" role="group" aria-label="Medias tallas">
                <span class="tallas-fila-etiqueta">Medias tallas</span>
                <div class="tallas-grid tallas-grid">${chipsMedias}</div>
            </div>
            ${btnVerMas}
            <div class="rango-tallas">
                <label for="rango-desde-${variante.id}">Desde</label>
                <select id="rango-desde-${variante.id}" data-rango-desde="${variante.id}">${opcionesDesde}</select>
                <label for="rango-hasta-${variante.id}">hasta</label>
                <select id="rango-hasta-${variante.id}" data-rango-hasta="${variante.id}">${opcionesHasta}</select>
                <label class="check-medias">
                    <input type="checkbox" data-check-medias="${variante.id}"> con medias tallas
                </label>
                <button type="button" class="btn-aplicar-rango" data-aplicar-rango="${variante.id}">
                    Aplicar rango
                </button>
            </div>
        </div>`;
}

// ─── Tabla de tallas ──────────────────────────────────────────────────────────

function renderTablaTallas(variante) {
    const tallasOrdenadas = ordenarTallas(Object.keys(variante.sizes));
    if (tallasOrdenadas.length === 0) return '';

    const conPrecios = estado.hasSizePricing;

    const encabezados = conPrecios
        ? `<th>Talla</th><th>Stock</th><th>Compra</th><th>Venta</th><th>Código de barras</th>`
        : `<th>Talla</th><th>Stock</th><th>Código de barras</th>`;

    const filas = tallasOrdenadas.map(size => {
        const item = variante.sizes[size];
        const preciosCols = conPrecios
            ? `<td><input type="number" class="input-tabla" value="${item.buy}"
                    placeholder="0" min="0" step="1"
                    aria-label="Precio compra talla ${etiquetaTalla(size)}"
                    data-campo="buy" data-variante="${variante.id}" data-size="${size}"></td>
               <td><input type="number" class="input-tabla" value="${item.sell}"
                    placeholder="0" min="0" step="1"
                    aria-label="Precio venta talla ${etiquetaTalla(size)}"
                    data-campo="sell" data-variante="${variante.id}" data-size="${size}"></td>`
            : '';
        return `<tr>
            <td><span class="talla-tag">${etiquetaTalla(size)}</span></td>
            <td><input type="number" class="input-tabla" value="${item.stock}"
                    placeholder="0" min="0" step="1"
                    aria-label="Stock talla ${etiquetaTalla(size)}"
                    data-campo="stock" data-variante="${variante.id}" data-size="${size}"></td>
            ${preciosCols}
            <td><input type="text" class="input-tabla" value="${item.barcode}"
                    placeholder="Código de barras"
                    aria-label="Código de barras talla ${etiquetaTalla(size)}"
                    data-campo="barcode" data-variante="${variante.id}" data-size="${size}"
                    maxlength="50"></td>
        </tr>`;
    }).join('');

    // Control "Mismo stock para todas"
    const mismoStock = `
        <div class="mismo-stock-row">
            <span>Mismo stock para todas:</span>
            <input type="number" placeholder="0" min="0" step="1"
                id="mismo-stock-val-${variante.id}" aria-label="Valor de stock para todas las tallas">
            <button type="button" data-aplicar-stock="${variante.id}">Aplicar</button>
        </div>`;

    return `
        ${mismoStock}
        <div class="tabla-tallas-wrapper">
            <table class="tabla-tallas" aria-label="Tallas y stock de este color">
                <thead><tr>${encabezados}</tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

// ─── Renderizado parcial de una card ──────────────────────────────────────────

function rerenderCard(varianteId) {
    const variante = estado.variants.find(v => v.id === varianteId);
    if (!variante) return;
    const cardExistente = listaColores.querySelector(`[data-id="${varianteId}"]`);
    if (!cardExistente) return;
    const nuevaCard = crearColorCard(variante);
    listaColores.replaceChild(nuevaCard, cardExistente);
    actualizarResumen();
}

// ─── Eventos de la tarjeta de color ──────────────────────────────────────────

function adjuntarEventosCard(card, variante) {
    // Foto
    const fotoBtnEl = card.querySelector(`[data-foto-btn="${variante.id}"]`);
    const inputFoto = card.querySelector(`#foto-${variante.id}`);
    fotoBtnEl.addEventListener('click', () => inputFoto.click());
    inputFoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            variante.imageFile    = file;
            variante.imagePreview = ev.target.result;
            rerenderCard(variante.id);
        };
        reader.readAsDataURL(file);
    });

    // Nombre del color
    card.querySelector(`[data-nombre-color="${variante.id}"]`)
        .addEventListener('input', (e) => {
            variante.color = e.target.value;
        });

    // Duplicar
    card.querySelector(`[data-duplicar="${variante.id}"]`)
        .addEventListener('click', () => duplicarVariante(variante.id));

    // Quitar
    card.querySelector(`[data-quitar="${variante.id}"]`)
        .addEventListener('click', () => quitarVariante(variante.id));

    // Chips de talla
    card.querySelectorAll(`[data-chip]`).forEach(chip => {
        chip.addEventListener('click', () => {
            const size = chip.dataset.chip;
            const vid  = chip.dataset.variante;
            toggleTalla(vid, size);
        });
    });

    // Ver más / ver menos tallas
    const btnVerMas = card.querySelector(`[data-ver-mas="${variante.id}"]`);
    if (btnVerMas) {
        btnVerMas.addEventListener('click', () => {
            // Guardamos el estado de expansión en el objeto variante para que
            // rerenderCard lo respete. Usamos un campo auxiliar no persistido.
            variante._expandido = !variante._expandido;
            rerenderCard(variante.id);
        });
    }

    // Aplicar rango
    const btnRango = card.querySelector(`[data-aplicar-rango="${variante.id}"]`);
    if (btnRango) {
        btnRango.addEventListener('click', () => aplicarRango(variante.id, card));
    }

    // Campos de la tabla
    card.querySelectorAll('[data-campo]').forEach(input => {
        input.addEventListener('change', (e) => {
            const { campo, variante: vid, size } = e.target.dataset;
            const v = estado.variants.find(x => x.id === vid);
            if (!v || !v.sizes[size]) return;
            v.sizes[size][campo] = e.target.value;
            actualizarResumen();
        });
    });

    // Mismo stock para todas
    const btnMismoStock = card.querySelector(`[data-aplicar-stock="${variante.id}"]`);
    if (btnMismoStock) {
        btnMismoStock.addEventListener('click', () => {
            const val = document.getElementById(`mismo-stock-val-${variante.id}`)?.value || '0';
            for (const size of Object.keys(variante.sizes)) {
                variante.sizes[size].stock = val;
            }
            rerenderCard(variante.id);
        });
    }
}

// ─── Operaciones sobre tallas ─────────────────────────────────────────────────

function toggleTalla(varianteId, size) {
    const v = estado.variants.find(x => x.id === varianteId);
    if (!v) return;

    if (v.sizes[size]) {
        // Quitar talla
        delete v.sizes[size];
    } else {
        // Agregar talla con barcode autogenerado
        v.sizes[size] = { stock: '0', buy: '', sell: '', barcode: generarCodigoUnico() };
    }
    rerenderCard(varianteId);
}

function aplicarRango(varianteId, card) {
    const desde     = parseInt(card.querySelector(`[data-rango-desde="${varianteId}"]`).value);
    const hasta     = parseInt(card.querySelector(`[data-rango-hasta="${varianteId}"]`).value);
    const conMedias = card.querySelector(`[data-check-medias="${varianteId}"]`).checked;

    if (desde > hasta) return;

    const v = estado.variants.find(x => x.id === varianteId);
    if (!v) return;

    const usados = codigosEnUso();

    for (let t = desde; t <= hasta; t++) {
        const key = String(t);
        if (!v.sizes[key]) {
            const codigo = generarCodigoSinConflicto(usados);
            usados.add(codigo);
            v.sizes[key] = { stock: '0', buy: '', sell: '', barcode: codigo };
        }
        // La media talla del máximo completo (FULL_MAX + 0.5) no se ofrece;
        // tampoco se genera para el último entero del rango (según spec: "36 a 38 con medias → sin 38½")
        if (conMedias && t < hasta) {
            const keyMedia = `${t}.5`;
            if (!v.sizes[keyMedia]) {
                const codigo = generarCodigoSinConflicto(usados);
                usados.add(codigo);
                v.sizes[keyMedia] = { stock: '0', buy: '', sell: '', barcode: codigo };
            }
        }
    }
    rerenderCard(varianteId);
}

function generarCodigoSinConflicto(usados) {
    let codigo;
    do { codigo = generarEAN13(); } while (usados.has(codigo));
    return codigo;
}

// ─── Operaciones sobre variantes ─────────────────────────────────────────────

function duplicarVariante(varianteId) {
    const original = estado.variants.find(v => v.id === varianteId);
    if (!original) return;

    const usados = codigosEnUso();
    const nuevosSizes = {};
    for (const [size, item] of Object.entries(original.sizes)) {
        const codigo = generarCodigoSinConflicto(usados);
        usados.add(codigo);
        nuevosSizes[size] = { ...item, stock: '0', barcode: codigo };
    }

    const nueva = {
        id: crypto.randomUUID(),
        color: '',        // nombre vacío (spec: "Duplicar color deja el nombre vacío")
        imageFile: null,
        imagePreview: null,
        sizes: nuevosSizes,
        _expandido: false,
    };

    const idx = estado.variants.findIndex(v => v.id === varianteId);
    estado.variants.splice(idx + 1, 0, nueva);

    listaColores.innerHTML = '';
    for (const v of estado.variants) {
        listaColores.appendChild(crearColorCard(v));
    }

    // Enfocar el input de nombre de la nueva variante
    requestAnimationFrame(() => {
        listaColores
            .querySelector(`[data-id="${nueva.id}"] [data-nombre-color="${nueva.id}"]`)
            ?.focus();
    });
    actualizarResumen();
}

function quitarVariante(varianteId) {
    if (estado.variants.length === 1) return; // siempre debe haber al menos uno
    estado.variants = estado.variants.filter(v => v.id !== varianteId);
    const card = listaColores.querySelector(`[data-id="${varianteId}"]`);
    card?.remove();
    actualizarResumen();
}

// ─── Validación ───────────────────────────────────────────────────────────────

function validar() {
    const errores = [];
    const nombre = document.getElementById('modeloNombre')?.value.trim();
    const catId  = document.getElementById('modeloCategoria')?.value;

    if (!nombre)  errores.push('El nombre del modelo es obligatorio.');
    if (!catId)   errores.push('La categoría es obligatoria.');

    if (!estado.hasSizePricing) {
        const buy  = parseFloat(document.getElementById('precioCompraUnico')?.value);
        const sell = parseFloat(document.getElementById('precioVentaUnico')?.value);
        if (!buy  || buy  <= 0) errores.push('El precio de compra debe ser mayor a 0.');
        if (!sell || sell <= 0) errores.push('El precio de venta debe ser mayor a 0.');
    }

    if (estado.variants.length === 0) {
        errores.push('Debe agregar al menos un color.');
    }

    // Chequear colores únicos (case-insensitive)
    const nombresColor = estado.variants.map(v =>
        document.querySelector(`[data-nombre-color="${v.id}"]`)?.value.trim().toLowerCase() || ''
    );

    const setNombres = new Set();
    nombresColor.forEach((n, i) => {
        if (!n) {
            errores.push(`Color #${i + 1}: el nombre del color es obligatorio.`);
        } else if (setNombres.has(n)) {
            errores.push(`Color "${estado.variants[i].color || n}": nombre duplicado dentro del modelo.`);
        } else {
            setNombres.add(n);
        }
    });

    // Chequear tallas y campos por color
    const todosCodigos = new Set();
    for (const v of estado.variants) {
        const colorNombre = document.querySelector(`[data-nombre-color="${v.id}"]`)?.value.trim() || `(sin nombre)`;
        const tallas = Object.keys(v.sizes);

        if (tallas.length === 0) {
            errores.push(`Color "${colorNombre}": debe tener al menos una talla.`);
            continue;
        }

        for (const size of tallas) {
            const item = v.sizes[size];
            const label = `Color "${colorNombre}", talla ${etiquetaTalla(size)}`;

            const stock = parseInt(item.stock);
            if (isNaN(stock) || stock < 0) {
                errores.push(`${label}: el stock debe ser un número entero ≥ 0.`);
            }

            if (estado.hasSizePricing) {
                const buy  = parseFloat(item.buy);
                const sell = parseFloat(item.sell);
                if (!buy  || buy  <= 0) errores.push(`${label}: falta precio de compra.`);
                if (!sell || sell <= 0) errores.push(`${label}: falta precio de venta.`);
            }

            if (!item.barcode) {
                errores.push(`${label}: falta código de barras.`);
            } else if (todosCodigos.has(item.barcode)) {
                errores.push(`Código de barras "${item.barcode}" está duplicado.`);
            } else {
                todosCodigos.add(item.barcode);
            }
        }
    }

    return errores;
}

function mostrarErrores(errores) {
    errListEl.classList.add('visible');
    errItemsEl.innerHTML = errores.map(e => `<li>${e}</li>`).join('');
    // Scroll al top del body del modal
    document.querySelector('.modal-calzado-body')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function ocultarErrores() {
    errListEl.classList.remove('visible');
    errItemsEl.innerHTML = '';
}

// ─── Construcción del payload ──────────────────────────────────────────────────

function construirPayload() {
    const nombre = document.getElementById('modeloNombre')?.value.trim();
    const catId  = parseInt(document.getElementById('modeloCategoria')?.value);
    const buyUni = parseFloat(document.getElementById('precioCompraUnico')?.value) || 0;
    const sellUni= parseFloat(document.getElementById('precioVentaUnico')?.value)  || 0;

    const variants = estado.variants.map(v => {
        const colorNombre = document.querySelector(`[data-nombre-color="${v.id}"]`)?.value.trim() || '';
        const items = ordenarTallas(Object.keys(v.sizes)).map(size => {
            const item = v.sizes[size];
            return {
                size,
                barcode:        item.barcode,
                purchase_price: estado.hasSizePricing ? parseFloat(item.buy)  : buyUni,
                sale_price:     estado.hasSizePricing ? parseFloat(item.sell) : sellUni,
                stock:          parseInt(item.stock) || 0,
            };
        });
        return {
            color:     colorNombre,
            image_url: null, // sin backend de upload, la URL queda null
            items,
        };
    });

    return {
        name: nombre,
        category_id: catId,
        has_size_pricing: estado.hasSizePricing,
        variants,
    };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function mostrarToast(mensaje, tipo = 'exito') {
    const div = document.createElement('div');
    div.className = `toast toast-${tipo}`;
    div.textContent = mensaje;
    toastCont.appendChild(div);
    setTimeout(() => div.remove(), 3500);
}

// ─── Guardar ──────────────────────────────────────────────────────────────────

function guardarCalzado() {
    // Sincronizar nombres de color desde los inputs al estado antes de validar
    for (const v of estado.variants) {
        const inputColor = document.querySelector(`[data-nombre-color="${v.id}"]`);
        if (inputColor) v.color = inputColor.value.trim();
    }

    const errores = validar();
    if (errores.length > 0) {
        mostrarErrores(errores);
        return;
    }

    ocultarErrores();
    const payload = construirPayload();
    console.log("payload")
    console.log(payload)
    // Sin backend: simular guardado y agregar fila en la tabla del inventario
    console.log('[ShoeStock] Payload a enviar a POST /api/products:', JSON.stringify(payload, null, 2));
    agregarFilasInventario(payload);
    cerrarModal();
    mostrarToast('Calzado registrado exitosamente');
}
 
/** Añade una fila resumen por cada variante al inventario visible. */
function agregarFilasInventario(payload) {
    const tbody = document.querySelector('.table-section table tbody');
    if (!tbody) return;

    const catMap = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.nombre]));
    const catNombre = catMap[payload.category_id] ?? `Cat. ${payload.category_id}`;

    // Total de stock y precio representativo para la tabla plana existente
    const todos  = payload.variants.flatMap(v => v.items);
    const totalStock = todos.reduce((s, i) => s + i.stock, 0);
    const precioRef  = todos[0] ?? {};

    for (const v of payload.variants) {
        const stockVariante = v.items.reduce((s, i) => s + i.stock, 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>—</td>
            <td>${payload.name} · ${v.color}</td>
            <td>${catNombre}</td>
            <td>$${(precioRef.purchase_price ?? 0).toLocaleString('es')}</td>
            <td>$${(precioRef.sale_price ?? 0).toLocaleString('es')}</td>
            <td>${stockVariante}</td>
            <td>
                <button class="btn-standard">Editar</button>
                <button class="btn-remove">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/>
                        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1 -12"/>
                        <path d="M9 7v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
                    </svg>
                </button>
            </td>`;
        tbody.appendChild(tr);
    }
}

// ─── Event listeners globales ─────────────────────────────────────────────────

// Abrir modal
btnAbrir?.addEventListener('click', abrirModal);

// Cerrar con botón X
btnCerrar?.addEventListener('click', pedirCierre);

// Cerrar haciendo clic en el fondo
overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) pedirCierre();
});

// Checkbox precio por talla
toggleEl?.addEventListener('change', () => {
    estado.hasSizePricing = toggleEl.checked;
    actualizarToggle();
    // Rerenderizar todas las tarjetas para actualizar columnas de precio
    listaColores.innerHTML = '';
    for (const v of estado.variants) {
        listaColores.appendChild(crearColorCard(v));
    }
});

// Agregar color
btnAgrColor?.addEventListener('click', () => {
    const nueva = crearVariante();
    estado.variants.push(nueva);
    const card = crearColorCard(nueva);
    listaColores.appendChild(card);
    actualizarResumen();
    card.querySelector(`[data-nombre-color="${nueva.id}"]`)?.focus();
});

// Guardar
btnGuardar?.addEventListener('click', guardarCalzado);

// Mini-modal de confirmación
confirmCancelar?.addEventListener('click', () => {
    confirmOverlay.classList.remove('active');
    document.getElementById('modeloNombre')?.focus();
});
confirmDescartar?.addEventListener('click', cerrarModal);
