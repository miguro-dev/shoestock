let productos = [];
let detalle = [];

fetch('../data/inventario.json')
    .then(response => response.json())
    .then(data => {
        productos = data;
        const tbody = document.querySelector('.table-section tbody');
        tbody.innerHTML = '';

        data.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.id}</td>
                <td>${producto.producto}</td>
                <td>${producto.categoria}</td>
                <td>${producto.stock}</td>
                <td>$${producto.precioVenta}</td>
                <td><button class="btn-standard" data-id="${producto.id}">Agregar</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-standard').forEach(btn => {
            btn.addEventListener('click', agregarAlDetalle);
        });
    });

function agregarAlDetalle(e) {

    const id = e.currentTarget.dataset.id;
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    detalle.push(producto);

    const tbody = document.querySelector('.two-columns > section:last-child .table-section tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${producto.producto}</td>
        <td>$${producto.precioVenta}</td>
        <td><button class="btn-remove" data-id="${producto.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-trash">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M4 7l16 0" />
                <path d="M10 11l0 6" />
                <path d="M14 11l0 6" />
                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
            </svg>
        </button></td>
    `;
    tbody.appendChild(tr);

    const total = detalle.reduce((sum, p) => sum + p.precioVenta, 0);
    document.querySelector('.sub-total-card span').textContent = `Total: $${total}`;
}