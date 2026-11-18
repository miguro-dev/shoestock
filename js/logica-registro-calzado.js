/**
 * logica-registro-calzado.js  (version: event delegation ONLY)
 * Modal form to register footwear (3 levels: product → variant (color) → item (size)).
 *
 * Compared with the original file, the ONLY behavioral/structural change is:
 *   - `adjuntarEventosCard` (per-element listeners, re-attached on every render) is gone.
 *   - The color list has ONE listener per event type (click, input, change) that dispatches
 *     by `data-action` / `data-field`, so cards and chips can be re-rendered or added
 *     without re-binding anything.
 * Everything else (full-card re-render, validation, payload, texts) is kept as it was.
 *
 * Identifiers are in English; HTML ids and CSS class names stay in Spanish because they are
 * the contract with inventario.html and styles.css.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default visible size range (chips shown without expanding). */
const VISIBLE_SIZE_MIN = 35;
const VISIBLE_SIZE_MAX = 44;

/**
 * Full size range (visible when expanding with "Ver más tallas").
 * The half size of the maximum (FULL_SIZE_MAX + 0.5) is not offered.
 */
const FULL_SIZE_MIN = 20;
const FULL_SIZE_MAX = 45;

/** Every whole size of the full range. */
const WHOLE_SIZES = Array.from({ length: FULL_SIZE_MAX - FULL_SIZE_MIN + 1 }, (_, index) => index + FULL_SIZE_MIN);

/** Fields of a size item that are edited from the table. */
const TABLE_FIELDS = ['stock', 'buy', 'sell', 'barcode'];

const CATEGORIES = [
    { id: 1, name: 'Deportivo' },
    { id: 2, name: 'Casual' },
    { id: 3, name: 'Formal' },
    { id: 4, name: 'Sandalia' },
    { id: 5, name: 'Bota' },
    { id: 6, name: 'Infantil' },
];

// ─── Form state ───────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id: string,
 *   color: string,
 *   imageFile: File|null,
 *   imagePreview: string|null,
 *   sizes: Record<string, { stock: string, buy: string, sell: string, barcode: string }>,
 *   isExpanded: boolean
 * }} Variant
 *
 * @typedef {{
 *   name: string,
 *   categoryId: number|null,
 *   hasSizePricing: boolean,
 *   buy: string,
 *   sell: string,
 *   variants: Variant[]
 * }} FormState
 */

/** @type {FormState} */
let formState = createInitialState();

function createInitialState() {
    return {
        name: '',
        categoryId: null,
        hasSizePricing: false,
        buy: '',
        sell: '',
        variants: [createVariant()],
    };
}

function createVariant() {
    return {
        id: crypto.randomUUID(),
        color: '',
        imageFile: null,
        imagePreview: null,
        sizes: {},
        isExpanded: false,
    };
}

function findVariant(variantId) {
    return formState.variants.find(variant => variant.id === variantId);
}

// ─── Barcode generation (simulated EAN-13) ────────────────────────────────────

/** Valid EAN-13: 12 random digits + check digit. */
function generateEan13() {
    const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const weightedSum = digits.reduce((sum, digit, index) => sum + (index % 2 === 0 ? digit : digit * 3), 0);
    const checkDigit = (10 - (weightedSum % 10)) % 10;
    return [...digits, checkDigit].join('');
}

/** Returns an EAN-13 that is not already used in the form. */
function generateUniqueBarcode() {
    return generateBarcodeAvoiding(collectUsedBarcodes());
}

/** Returns an EAN-13 that is not in `usedBarcodes` (the caller adds it to the set when looping). */
function generateBarcodeAvoiding(usedBarcodes) {
    let barcode;
    do { barcode = generateEan13(); } while (usedBarcodes.has(barcode));
    return barcode;
}

/** Collects every barcode currently in the form state. */
function collectUsedBarcodes() {
    const barcodes = new Set();
    for (const variant of formState.variants) {
        for (const item of Object.values(variant.sizes)) {
            if (item.barcode) barcodes.add(item.barcode);
        }
    }
    return barcodes;
}

// ─── Size formatting ──────────────────────────────────────────────────────────

/** Canonical string "36.5" → display label "36½". */
function formatSizeLabel(size) {
    if (String(size).endsWith('.5')) {
        return `${parseInt(size)}½`;
    }
    return String(size);
}

/** Sorts sizes numerically. */
function sortSizes(sizes) {
    return [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b));
}

// ─── DOM references ───────────────────────────────────────────────────────────

const modalOverlay = document.getElementById('modalCalzadoOverlay');
const closeModalButton = document.getElementById('modalCalzadoCerrar');
const openModalButton = document.getElementById('btnAddProduct');
const pricePerSizeCheckbox = document.getElementById('togglePrecioPorTalla'); // <input type="checkbox">
const singlePriceFields = document.getElementById('preciosUnicos');
const colorList = document.getElementById('listaColores');
const addColorButton = document.getElementById('btnAgregarColor');
const summaryElement = document.getElementById('resumenFormulario');
const errorListElement = document.getElementById('listaErrores');
const errorItemsElement = document.getElementById('listaErroresItems');
const saveButton = document.getElementById('btnGuardarCalzado');
const toastContainer = document.getElementById('toastContenedor');

// Discard-confirmation mini-modal
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmKeepEditingButton = document.getElementById('confirmCancelar');
const confirmDiscardButton = document.getElementById('confirmDescartar');

// ─── Open / close modal ───────────────────────────────────────────────────────

let elementFocusedBeforeOpen = null; // button that opened the modal, to give the focus back

function openModal() {
    elementFocusedBeforeOpen = document.activeElement;
    formState = createInitialState();
    renderEntireForm();
    modalOverlay.classList.add('active');
    // Initial focus on the model name
    requestAnimationFrame(() => {
        document.getElementById('modeloNombre')?.focus();
    });
    document.addEventListener('keydown', trapFocus);
}

function requestCloseModal() {
    if (formHasData()) {
        confirmOverlay.classList.add('active');
        confirmDiscardButton.focus();
    } else {
        closeModal();
    }
}

function closeModal() {
    modalOverlay.classList.remove('active');
    confirmOverlay.classList.remove('active');
    document.removeEventListener('keydown', trapFocus);
    elementFocusedBeforeOpen?.focus();
}

function formHasData() {
    const modelName = document.getElementById('modeloNombre')?.value.trim();
    if (modelName) return true;
    for (const variant of formState.variants) {
        if (variant.color || Object.keys(variant.sizes).length > 0) return true;
    }
    return false;
}

// ─── Focus trap (accessibility) ───────────────────────────────────────────────

function trapFocus(event) {
    if (event.key === 'Escape') {
        requestCloseModal();
        return;
    }
    if (event.key !== 'Tab') return;

    // Pick the outermost visible dialog
    const activeDialog = confirmOverlay.classList.contains('active') ? confirmOverlay : modalOverlay;
    const focusableElements = [...activeDialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
    )];

    if (focusableElements.length === 0) return;
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
        if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
    } else {
        if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
}

// ─── "Price per size" toggle ──────────────────────────────────────────────────

function updatePricingMode() {
    const isPerSize = formState.hasSizePricing;
    if (pricePerSizeCheckbox) pricePerSizeCheckbox.checked = isPerSize;
    singlePriceFields.style.display = isPerSize ? 'none' : 'flex';
}

// ─── Footer summary ───────────────────────────────────────────────────────────

function updateSummary() {
    let sizeCount = 0;
    let pairCount = 0;
    const colorCount = formState.variants.length;
    for (const variant of formState.variants) {
        const items = Object.values(variant.sizes);
        sizeCount += items.length;
        pairCount += items.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0);
    }
    summaryElement.innerHTML =
        `<strong>${colorCount}</strong> color${colorCount !== 1 ? 'es' : ''} · ` +
        `<strong>${sizeCount}</strong> talla${sizeCount !== 1 ? 's' : ''} · ` +
        `<strong>${pairCount}</strong> par${pairCount !== 1 ? 'es' : ''}`;
}

// ─── Full render ──────────────────────────────────────────────────────────────

function renderEntireForm() {
    // Sync model fields
    const nameInput = document.getElementById('modeloNombre');
    const categorySelect = document.getElementById('modeloCategoria');
    const buyInput = document.getElementById('precioCompraUnico');
    const sellInput = document.getElementById('precioVentaUnico');

    if (nameInput) nameInput.value = formState.name;
    if (categorySelect) categorySelect.value = formState.categoryId ?? '';
    if (buyInput) buyInput.value = formState.buy;
    if (sellInput) sellInput.value = formState.sell;

    updatePricingMode();
    renderAllColorCards();
    hideErrors();
    updateSummary();
}

function renderAllColorCards() {
    colorList.innerHTML = '';
    for (const variant of formState.variants) {
        colorList.appendChild(createColorCard(variant));
    }
}

// ─── Color card (markup only: events are handled by the delegated listeners) ──

function createColorCard(variant) {
    const card = document.createElement('div');
    card.className = 'color-card';
    card.dataset.variantId = variant.id;

    card.innerHTML = `
        <div class="color-card-header">
            <!-- Photo -->
            <button type="button" class="color-foto-btn" aria-label="Subir foto del color"
                data-action="pick-photo" data-variant-id="${variant.id}">
                ${variant.imagePreview
                    ? `<img src="${variant.imagePreview}" alt="Vista previa">`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round">
                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3L14.5 4z"/>
                            <circle cx="12" cy="13" r="3"/>
                        </svg>`}
            </button>
            <input type="file" accept="image/*" class="input-foto-color"
                id="foto-${variant.id}" data-field="photo" data-variant-id="${variant.id}">

            <!-- Color name -->
            <input type="text" class="color-nombre-input" placeholder="Nombre del color (ej: Negro / Rojo)"
                value="${variant.color}" aria-label="Nombre del color"
                data-field="color" data-variant-id="${variant.id}">

            <!-- Actions -->
            <div class="color-acciones">
                <button type="button" class="btn-icon-sm" title="Duplicar color"
                    aria-label="Duplicar color" data-action="duplicate-color" data-variant-id="${variant.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <rect x="8" y="8" width="13" height="13" rx="2" ry="2"/>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                </button>
                <button type="button" class="btn-icon-sm peligro" title="Quitar color"
                    aria-label="Quitar color" data-action="remove-color" data-variant-id="${variant.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        </div>

        <div class="color-card-body">
            ${renderSizeSelector(variant)}
            ${renderSizeTable(variant)}
        </div>
    `;

    return card;
}

// ─── Size selector ────────────────────────────────────────────────────────────

/**
 * True if any selected size is outside the visible range (VISIBLE_SIZE_MIN–VISIBLE_SIZE_MAX).
 * In that case the rows must be shown expanded so no selected size stays hidden.
 * @param {Set<string>} selectedSizes
 */
function hasSizesOutsideVisibleRange(selectedSizes) {
    for (const size of selectedSizes) {
        const wholePart = Math.floor(parseFloat(size));
        if (wholePart < VISIBLE_SIZE_MIN || wholePart > VISIBLE_SIZE_MAX) return true;
    }
    return false;
}

function renderSizeSelector(variant) {
    const selectedSizes = new Set(Object.keys(variant.sizes));

    // Auto-expand when there are sizes outside the visible range; also honors the manual toggle.
    const isExpanded = variant.isExpanded || hasSizesOutsideVisibleRange(selectedSizes);

    const wholeSizesToShow = WHOLE_SIZES.filter(size =>
        isExpanded ? true : (size >= VISIBLE_SIZE_MIN && size <= VISIBLE_SIZE_MAX)
    );
    // The half size of the full maximum (FULL_SIZE_MAX + 0.5) is not offered
    const halfSizeBasesToShow = WHOLE_SIZES.filter(size =>
        isExpanded ? size < FULL_SIZE_MAX : (size >= VISIBLE_SIZE_MIN && size <= VISIBLE_SIZE_MAX)
    );

    // Row 1: whole-size chips (independent)
    const wholeChips = wholeSizesToShow.map(size => {
        const key = String(size);
        const isActive = selectedSizes.has(key);
        return `<button type="button" class="chip-talla"
            aria-pressed="${isActive}" data-action="toggle-size" data-variant-id="${variant.id}" data-size="${key}"
            aria-label="Talla ${key}">${key}</button>`;
    }).join('');

    // Row 2: half-size chips (fully independent from the whole sizes)
    const halfChips = halfSizeBasesToShow.map(size => {
        const key = `${size}.5`;
        const isActive = selectedSizes.has(key);
        return `<button type="button" class="chip-talla"
            aria-pressed="${isActive}" data-action="toggle-size" data-variant-id="${variant.id}" data-size="${key}"
            aria-label="Talla ${size} y medio">${formatSizeLabel(key)}</button>`;
    }).join('');

    // Expand / collapse button
    const expandButton = `<button type="button" class="btn-ver-mas-tallas"
        data-action="toggle-expanded" data-variant-id="${variant.id}" aria-expanded="${isExpanded}">
        ${isExpanded ? 'Ver menos tallas' : 'Ver más tallas'}
    </button>`;

    // Range controls: selects with the full range
    const fromOptions = WHOLE_SIZES.map(size =>
        `<option value="${size}" ${size === VISIBLE_SIZE_MIN ? 'selected' : ''}>${size}</option>`
    ).join('');
    const toOptions = WHOLE_SIZES.map(size =>
        `<option value="${size}" ${size === VISIBLE_SIZE_MAX ? 'selected' : ''}>${size}</option>`
    ).join('');

    return `
        <div class="tallas-selector">
            <div class="tallas-fila-grupo" role="group" aria-label="Tallas enteras">
                <span class="tallas-fila-etiqueta">Tallas enteras</span>
                <div class="tallas-grid">${wholeChips}</div>
            </div>
            <div class="tallas-fila-grupo" role="group" aria-label="Medias tallas">
                <span class="tallas-fila-etiqueta">Medias tallas</span>
                <div class="tallas-grid tallas-grid">${halfChips}</div>
            </div>
            ${expandButton}
            <div class="rango-tallas">
                <label for="rango-desde-${variant.id}">Desde</label>
                <select id="rango-desde-${variant.id}" data-range-from>${fromOptions}</select>
                <label for="rango-hasta-${variant.id}">hasta</label>
                <select id="rango-hasta-${variant.id}" data-range-to>${toOptions}</select>
                <label class="check-medias">
                    <input type="checkbox" data-range-include-halves> con medias tallas
                </label>
                <button type="button" class="btn-aplicar-rango" data-action="apply-range"
                    data-variant-id="${variant.id}">
                    Aplicar rango
                </button>
            </div>
        </div>`;
}

// ─── Size table ───────────────────────────────────────────────────────────────

function renderSizeTable(variant) {
    const sortedSizes = sortSizes(Object.keys(variant.sizes));
    if (sortedSizes.length === 0) return '';

    const showPrices = formState.hasSizePricing;

    const headers = showPrices
        ? `<th>Talla</th><th>Stock</th><th>Compra</th><th>Venta</th><th>Código de barras</th>`
        : `<th>Talla</th><th>Stock</th><th>Código de barras</th>`;

    const rows = sortedSizes.map(size => {
        const item = variant.sizes[size];
        const priceCells = showPrices
            ? `<td><input type="number" class="input-tabla" value="${item.buy}"
                    placeholder="0" min="0" step="1"
                    aria-label="Precio compra talla ${formatSizeLabel(size)}"
                    data-field="buy" data-variant-id="${variant.id}" data-size="${size}"></td>
               <td><input type="number" class="input-tabla" value="${item.sell}"
                    placeholder="0" min="0" step="1"
                    aria-label="Precio venta talla ${formatSizeLabel(size)}"
                    data-field="sell" data-variant-id="${variant.id}" data-size="${size}"></td>`
            : '';
        return `<tr>
            <td><span class="talla-tag">${formatSizeLabel(size)}</span></td>
            <td><input type="number" class="input-tabla" value="${item.stock}"
                    placeholder="0" min="0" step="1"
                    aria-label="Stock talla ${formatSizeLabel(size)}"
                    data-field="stock" data-variant-id="${variant.id}" data-size="${size}"></td>
            ${priceCells}
            <td><input type="text" class="input-tabla" value="${item.barcode}"
                    placeholder="Código de barras"
                    aria-label="Código de barras talla ${formatSizeLabel(size)}"
                    data-field="barcode" data-variant-id="${variant.id}" data-size="${size}"
                    maxlength="50"></td>
        </tr>`;
    }).join('');

    // "Same stock for all" control
    const sameStockRow = `
        <div class="mismo-stock-row">
            <span>Mismo stock para todas:</span>
            <input type="number" placeholder="0" min="0" step="1"
                id="mismo-stock-val-${variant.id}" aria-label="Valor de stock para todas las tallas">
            <button type="button" data-action="apply-same-stock" data-variant-id="${variant.id}">Aplicar</button>
        </div>`;

    return `
        ${sameStockRow}
        <div class="tabla-tallas-wrapper">
            <table class="tabla-tallas" aria-label="Tallas y stock de este color">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

// ─── Re-render one card ───────────────────────────────────────────────────────

function rerenderCard(variantId) {
    const variant = findVariant(variantId);
    if (!variant) return;
    const existingCard = getCardElement(variantId);
    if (!existingCard) return;
    // No listeners to re-attach: the delegated ones on #listaColores keep working.
    colorList.replaceChild(createColorCard(variant), existingCard);
    updateSummary();
}

function getCardElement(variantId) {
    return colorList.querySelector(`.color-card[data-variant-id="${variantId}"]`);
}

function getColorNameInput(variantId) {
    return colorList.querySelector(`[data-field="color"][data-variant-id="${variantId}"]`);
}

// ─── Event delegation: one listener per event type for the whole color list ───

/** Buttons: dispatches by `data-action`. */
function handleColorListClick(event) {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement || !colorList.contains(actionElement)) return;

    const { action, variantId, size } = actionElement.dataset;
    const variant = findVariant(variantId);
    if (!variant) return;

    switch (action) {
        case 'pick-photo':
            document.getElementById(`foto-${variantId}`).click();
            break;
        case 'duplicate-color':
            duplicateVariant(variantId);
            break;
        case 'remove-color':
            removeVariant(variantId);
            break;
        case 'toggle-size':
            toggleSize(variantId, size);
            break;
        case 'toggle-expanded':
            variant.isExpanded = !variant.isExpanded;
            rerenderCard(variantId);
            break;
        case 'apply-range':
            applySizeRange(variantId, getCardElement(variantId));
            break;
        case 'apply-same-stock':
            applySameStock(variantId);
            break;
    }
}

/** Color name: updates the state while typing. */
function handleColorListInput(event) {
    const { field, variantId } = event.target.dataset;
    if (field !== 'color') return;
    const variant = findVariant(variantId);
    if (variant) variant.color = event.target.value;
}

/** Table inputs and photo input: dispatches by `data-field`. */
function handleColorListChange(event) {
    const input = event.target;
    const { field, variantId, size } = input.dataset;
    const variant = findVariant(variantId);
    if (!field || !variant) return;

    if (field === 'photo') {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = loadEvent => {
            variant.imageFile = file;
            variant.imagePreview = loadEvent.target.result;
            rerenderCard(variant.id);
        };
        reader.readAsDataURL(file);
        return;
    }

    if (TABLE_FIELDS.includes(field) && variant.sizes[size]) {
        variant.sizes[size][field] = input.value;
        updateSummary();
    }
}

// ─── Size operations ──────────────────────────────────────────────────────────

function toggleSize(variantId, size) {
    const variant = findVariant(variantId);
    if (!variant) return;

    if (variant.sizes[size]) {
        // Remove size
        delete variant.sizes[size];
    } else {
        // Add size with an auto-generated barcode
        variant.sizes[size] = { stock: '0', buy: '', sell: '', barcode: generateUniqueBarcode() };
    }
    rerenderCard(variantId);
}

function applySizeRange(variantId, card) {
    const from = parseInt(card.querySelector('[data-range-from]').value);
    const to = parseInt(card.querySelector('[data-range-to]').value);
    const includeHalves = card.querySelector('[data-range-include-halves]').checked;

    if (from > to) return;

    const variant = findVariant(variantId);
    if (!variant) return;

    const usedBarcodes = collectUsedBarcodes();

    for (let size = from; size <= to; size++) {
        const key = String(size);
        if (!variant.sizes[key]) {
            const barcode = generateBarcodeAvoiding(usedBarcodes);
            usedBarcodes.add(barcode);
            variant.sizes[key] = { stock: '0', buy: '', sell: '', barcode };
        }
        // No half size after the last whole size ("36 to 38 with halves" → no 38½)
        if (includeHalves && size < to) {
            const halfKey = `${size}.5`;
            if (!variant.sizes[halfKey]) {
                const barcode = generateBarcodeAvoiding(usedBarcodes);
                usedBarcodes.add(barcode);
                variant.sizes[halfKey] = { stock: '0', buy: '', sell: '', barcode };
            }
        }
    }
    rerenderCard(variantId);
}

function applySameStock(variantId) {
    const variant = findVariant(variantId);
    if (!variant) return;
    const stockValue = document.getElementById(`mismo-stock-val-${variantId}`)?.value || '0';
    for (const size of Object.keys(variant.sizes)) {
        variant.sizes[size].stock = stockValue;
    }
    rerenderCard(variantId);
}

// ─── Variant (color) operations ───────────────────────────────────────────────

function duplicateVariant(variantId) {
    const original = findVariant(variantId);
    if (!original) return;

    const usedBarcodes = collectUsedBarcodes();
    const copiedSizes = {};
    for (const [size, item] of Object.entries(original.sizes)) {
        const barcode = generateBarcodeAvoiding(usedBarcodes);
        usedBarcodes.add(barcode);
        copiedSizes[size] = { ...item, stock: '0', barcode };
    }

    const copy = {
        id: crypto.randomUUID(),
        color: '', // empty name (spec: "Duplicar color deja el nombre vacío")
        imageFile: null,
        imagePreview: null,
        sizes: copiedSizes,
        isExpanded: false,
    };

    const index = formState.variants.findIndex(variant => variant.id === variantId);
    formState.variants.splice(index + 1, 0, copy);

    renderAllColorCards();

    // Focus the name input of the new variant
    requestAnimationFrame(() => {
        getColorNameInput(copy.id)?.focus();
    });
    updateSummary();
}

function removeVariant(variantId) {
    if (formState.variants.length === 1) return; // there must always be at least one
    formState.variants = formState.variants.filter(variant => variant.id !== variantId);
    getCardElement(variantId)?.remove();
    updateSummary();
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm() {
    const errors = [];
    const modelName = document.getElementById('modeloNombre')?.value.trim();
    const categoryId = document.getElementById('modeloCategoria')?.value;

    if (!modelName) errors.push('El nombre del modelo es obligatorio.');
    if (!categoryId) errors.push('La categoría es obligatoria.');

    if (!formState.hasSizePricing) {
        const buy = parseFloat(document.getElementById('precioCompraUnico')?.value);
        const sell = parseFloat(document.getElementById('precioVentaUnico')?.value);
        if (!buy || buy <= 0) errors.push('El precio de compra debe ser mayor a 0.');
        if (!sell || sell <= 0) errors.push('El precio de venta debe ser mayor a 0.');
    }

    if (formState.variants.length === 0) {
        errors.push('Debe agregar al menos un color.');
    }

    // Unique color names (case-insensitive)
    const colorNames = formState.variants.map(variant =>
        getColorNameInput(variant.id)?.value.trim().toLowerCase() || ''
    );

    const seenColorNames = new Set();
    colorNames.forEach((name, index) => {
        if (!name) {
            errors.push(`Color #${index + 1}: el nombre del color es obligatorio.`);
        } else if (seenColorNames.has(name)) {
            errors.push(`Color "${formState.variants[index].color || name}": nombre duplicado dentro del modelo.`);
        } else {
            seenColorNames.add(name);
        }
    });

    // Sizes and fields per color
    const seenBarcodes = new Set();
    for (const variant of formState.variants) {
        const colorName = getColorNameInput(variant.id)?.value.trim() || `(sin nombre)`;
        const sizes = Object.keys(variant.sizes);

        if (sizes.length === 0) {
            errors.push(`Color "${colorName}": debe tener al menos una talla.`);
            continue;
        }

        for (const size of sizes) {
            const item = variant.sizes[size];
            const label = `Color "${colorName}", talla ${formatSizeLabel(size)}`;

            const stock = parseInt(item.stock);
            if (isNaN(stock) || stock < 0) {
                errors.push(`${label}: el stock debe ser un número entero ≥ 0.`);
            }

            if (formState.hasSizePricing) {
                const buy = parseFloat(item.buy);
                const sell = parseFloat(item.sell);
                if (!buy || buy <= 0) errors.push(`${label}: falta precio de compra.`);
                if (!sell || sell <= 0) errors.push(`${label}: falta precio de venta.`);
            }

            if (!item.barcode) {
                errors.push(`${label}: falta código de barras.`);
            } else if (seenBarcodes.has(item.barcode)) {
                errors.push(`Código de barras "${item.barcode}" está duplicado.`);
            } else {
                seenBarcodes.add(item.barcode);
            }
        }
    }

    return errors;
}

function showErrors(errors) {
    errorListElement.classList.add('visible');
    errorItemsElement.innerHTML = errors.map(message => `<li>${message}</li>`).join('');
    // Scroll to the top of the modal body
    document.querySelector('.modal-calzado-body')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideErrors() {
    errorListElement.classList.remove('visible');
    errorItemsElement.innerHTML = '';
}

// ─── Payload ──────────────────────────────────────────────────────────────────

function buildPayload() {
    const modelName = document.getElementById('modeloNombre')?.value.trim();
    const categoryId = parseInt(document.getElementById('modeloCategoria')?.value);
    const singleBuy = parseFloat(document.getElementById('precioCompraUnico')?.value) || 0;
    const singleSell = parseFloat(document.getElementById('precioVentaUnico')?.value) || 0;

    const variants = formState.variants.map(variant => {
        const colorName = getColorNameInput(variant.id)?.value.trim() || '';
        const items = sortSizes(Object.keys(variant.sizes)).map(size => {
            const item = variant.sizes[size];
            return {
                size,
                barcode: item.barcode,
                purchase_price: formState.hasSizePricing ? parseFloat(item.buy) : singleBuy,
                sale_price: formState.hasSizePricing ? parseFloat(item.sell) : singleSell,
                stock: parseInt(item.stock) || 0,
            };
        });
        return {
            color: colorName,
            image_url: null, // no upload backend yet, the URL stays null
            items,
        };
    });

    return {
        name: modelName,
        category_id: categoryId,
        has_size_pricing: formState.hasSizePricing,
        variants,
    };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message, type = 'exito') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ─── Save ─────────────────────────────────────────────────────────────────────

function saveFootwear() {
    // Sync color names from the inputs to the state before validating
    for (const variant of formState.variants) {
        const colorInput = getColorNameInput(variant.id);
        if (colorInput) variant.color = colorInput.value.trim();
    }

    const errors = validateForm();
    if (errors.length > 0) {
        showErrors(errors);
        return;
    }

    hideErrors();
    const payload = buildPayload();
    console.log("payload")
    console.log(payload)
    // No backend: simulate saving and add a row to the inventory table
    console.log('[ShoeStock] Payload a enviar a POST /api/products:', JSON.stringify(payload, null, 2));
    appendRowsToInventoryTable(payload);
    closeModal();
    showToast('Calzado registrado exitosamente');
}

/** Adds one summary row per variant to the visible inventory table. */
function appendRowsToInventoryTable(payload) {
    const tableBody = document.querySelector('.table-section table tbody');
    if (!tableBody) return;

    const categoryNames = Object.fromEntries(CATEGORIES.map(category => [category.id, category.name]));
    const categoryName = categoryNames[payload.category_id] ?? `Cat. ${payload.category_id}`;

    // Representative price for the existing flat table
    const allItems = payload.variants.flatMap(variant => variant.items);
    const referenceItem = allItems[0] ?? {};

    for (const variant of payload.variants) {
        const variantStock = variant.items.reduce((sum, item) => sum + item.stock, 0);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>—</td>
            <td>${payload.name} · ${variant.color}</td>
            <td>${categoryName}</td>
            <td>$${(referenceItem.purchase_price ?? 0).toLocaleString('es')}</td>
            <td>$${(referenceItem.sale_price ?? 0).toLocaleString('es')}</td>
            <td>${variantStock}</td>
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
        tableBody.appendChild(row);
    }
}

// ─── Global event listeners ───────────────────────────────────────────────────

// Open modal
openModalButton?.addEventListener('click', openModal);

// Close with the X button
closeModalButton?.addEventListener('click', requestCloseModal);

// Close by clicking the backdrop
modalOverlay?.addEventListener('click', event => {
    if (event.target === modalOverlay) requestCloseModal();
});

// "Price per size" checkbox
pricePerSizeCheckbox?.addEventListener('change', () => {
    formState.hasSizePricing = pricePerSizeCheckbox.checked;
    updatePricingMode();
    // Re-render every card to show/hide the price columns
    renderAllColorCards();
});

// Add color
addColorButton?.addEventListener('click', () => {
    const variant = createVariant();
    formState.variants.push(variant);
    const card = createColorCard(variant);
    colorList.appendChild(card);
    updateSummary();
    getColorNameInput(variant.id)?.focus();
});

// Color list: the three delegated listeners (this replaces every per-card listener)
colorList.addEventListener('click', handleColorListClick);
colorList.addEventListener('input', handleColorListInput);
colorList.addEventListener('change', handleColorListChange);

// Save
saveButton?.addEventListener('click', saveFootwear);

// Discard-confirmation mini-modal
confirmKeepEditingButton?.addEventListener('click', () => {
    confirmOverlay.classList.remove('active');
    document.getElementById('modeloNombre')?.focus();
});
confirmDiscardButton?.addEventListener('click', closeModal);
