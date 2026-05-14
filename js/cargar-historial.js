fetch('../data/historial.json')
    .then(response => response.json())
    .then(ventas => {
        const tbody = document.querySelector('.table-section tbody');
        tbody.innerHTML = '';
        
        ventas.forEach(venta => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${venta.id}</td>
                <td>${venta.fecha}</td>
                <td>${venta.producto}</td>
                <td>${venta.cantidad}</td>
                <td>${venta.vendedor}</td>
                <td>$${venta.descuento.toFixed(2)}</td>
                <td>$${venta.total.toFixed(2)}</td>
                <td><button>Ver Detalles</button></td>
            `;
            tbody.appendChild(tr);
        });
    });