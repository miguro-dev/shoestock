fetch('../data/usuarios.json')
    .then(response => response.json())
    .then(usuarios => {
        const tbody = document.querySelector('.table-section tbody');
        tbody.innerHTML = '';

        usuarios.forEach(usuario => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${usuario.id}</td>
                <td>${usuario.usuario}</td>
                <td>${usuario.rol}</td>
                <td><button>Editar</button><button>Eliminar</button></td>
            `;
            tbody.appendChild(tr);
        });
    });