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
                <td><button class="btn-agregar" data-id="${producto.id}">Agregar</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-agregar').forEach(btn => {
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
        <td></td>
    `;
    tbody.appendChild(tr);

    const total = detalle.reduce((sum, p) => sum + p.precioVenta, 0);
    document.querySelector('.sub-total-card span').textContent = `Total: $${total}`;
}