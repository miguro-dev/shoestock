fetch('../data/ventas.json')
    .then(response => response.json())
    .then(productos => {
        const tbody = document.querySelector('.table-section tbody');
        tbody.innerHTML = '';
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.id}</td>
                <td>${producto.producto}</td>
                <td>${producto.cantidad}</td>
                <td>$${producto.precioUnitario.toFixed(2)}</td>
                <td>$${producto.total.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    });