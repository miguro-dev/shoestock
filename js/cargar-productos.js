fetch('../data/inventario.json')
    .then(response => response.json())
    .then(productos => {
        const tbody = document.querySelector('.table-section tbody');
        tbody.innerHTML = '';
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.id}</td>
                <td>${producto.producto}</td>
                <td>${producto.categoria}</td>
                <td>${producto.stock}</td>
                <td>$${producto.precioVenta.toFixed(2)}</td>
                <td><button>Agregar</button></td>
            `;
            tbody.appendChild(tr);
        });
    });