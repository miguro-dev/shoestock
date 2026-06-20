const overlay = document.getElementById('modalOverlay');
const btnAdd = document.getElementById('btnAddProduct');
const btnClose = document.getElementById('modalClose');
const form = document.getElementById('modalForm');

function abrirModal() {
    overlay.classList.add('active');
}

function cerrarModal() {
    overlay.classList.remove('active');
}

btnAdd.addEventListener('click', abrirModal);
btnClose.addEventListener('click', cerrarModal);

overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModal();
});

fetch('../data/inventario.json')
    .then(response => response.json())
    .then(productos => {
        const tbody = document.querySelector('.table-section table tbody');
        tbody.innerHTML = '';
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.id}</td>
                <td>${producto.producto}</td>
                <td>${producto.categoria}</td>
                <td>$${producto.precioCompra.toFixed(2)}</td>
                <td>$${producto.precioVenta.toFixed(2)}</td>
                <td>${producto.stock}</td>
                <td><button>Editar</button><button>Eliminar</button></td>
            `;
            tbody.appendChild(tr);
        });
    });

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    agregarProducto(datos);
    cerrarModal();
    form.reset();
});

function agregarProducto(producto) {
    const tbody = document.querySelector('.table-section tbody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${producto.codigo}</td>
        <td>${producto.nombre}</td>
        <td>${producto.categoria}</td>
        <td>$${parseFloat(producto.precioCompra).toFixed(2)}</td>
        <td>$${parseFloat(producto.precioVenta).toFixed(2)}</td>
        <td>${producto.stock}</td>
        <td><button>Editar</button><button>Eliminar</button></td>
    `;
    tbody.appendChild(tr);
}
