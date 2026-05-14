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