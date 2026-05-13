fetch('../data/historial.json')
    .then(response => response.json())
    .then(data => console.log(data));