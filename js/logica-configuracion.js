const overlay = document.getElementById('modalOverlay');
const btnAdd = document.getElementById('btnAddUser');
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
                <td><button class="btn-standard">Editar</button><button class="btn-standard">Eliminar</button></td>
            `;
            tbody.appendChild(tr);
        });
    });

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    agregarUsuario(datos);
    cerrarModal();
    form.reset();
});

function agregarUsuario(usuario) {
    const tbody = document.querySelector('.table-section tbody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${usuario.userId}</td>
        <td>${usuario.userName}</td>
        <td>${usuario.userRol}</td>
        <td><button class="btn-standard">Editar</button><button class="btn-standard">Eliminar</button></td>
    `;
    tbody.appendChild(tr);
}
