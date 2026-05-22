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

const form = document.querySelector('.config-form');
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    console.log('Datos del usuario:', datos);
    agregarUsuario(datos);
});

function agregarUsuario(usuario) {
    const tbody = document.querySelector('.table-section tbody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${usuario.userId}</td>
        <td>${usuario.userName}</td>
        <td>${usuario.userRol}</td>
        <td><button>Editar</button><button>Eliminar</button></td>
    `;
    tbody.appendChild(tr);
}