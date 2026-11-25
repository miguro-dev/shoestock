// El modal de nuevo producto ahora lo maneja logica-registro-calzado.js
// Este archivo conserva la carga de la tabla de inventario.

const CATEGORIES = {
    1: 'Deportivo',
    2: 'Casual',
    3: 'Formal',
    4: 'Sandalia',
    5: 'Bota',
    6: 'Infantil',
};

// SVG: ojo (ver)
const SVG_VER = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
</svg>`;

// SVG: lápiz (editar)
const SVG_EDITAR = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
</svg>`;

// SVG: papelera (eliminar)
const SVG_ELIMINAR = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
    <path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/>
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>
</svg>`;

fetch('../data/inventario.json')
    .then(response => response.json())
    .then(productos => {
        const tbody = document.querySelector('.table-section table tbody');
        tbody.innerHTML = '';

        productos.forEach(producto => {
            const categoriaNombre = CATEGORIES[producto.category_id] ?? `Categoría ${producto.category_id}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.name}</td>
                <td>${categoriaNombre}</td>
                <td class="actions-cell">
                    <button class="btn-icon-sm" title="Ver detalle" aria-label="Ver detalle de ${producto.name}">
                        ${SVG_VER}
                    </button>
                    <button class="btn-icon-sm" title="Editar" aria-label="Editar ${producto.name}">
                        ${SVG_EDITAR}
                    </button>
                    <button class="btn-icon-sm danger" title="Eliminar" aria-label="Eliminar ${producto.name}">
                        ${SVG_ELIMINAR}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
