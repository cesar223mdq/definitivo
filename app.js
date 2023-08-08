const axios = require('axios');
const { create, Client } = require('@open-wa/wa-automate');

// URL de tu API
const apiUrl = ' https://api-caluculadora.onrender.com'; // Cambia esto si es necesario

// Crear cliente de WhatsApp
const createClient = async () => {
    const client = await create();
    return client;
};

// Función para enviar un mensaje
async function enviarMensaje(client, destinatario, mensaje) {
    await client.sendText(destinatario, mensaje);
}

// Almacena el estado de la conversación por cada chat
const estadosConversacion = {};

// Función para iniciar la conversación
async function iniciarConversacion(client, chatId) {
    await enviarMensaje(client, chatId, 'Hola, ¿cuánto es todo?');
    estadosConversacion[chatId] = { estado: 'esperando_valor_total' };
}

// Función para procesar respuestas
async function procesarRespuesta(client, chatId, respuesta) {
    const estado = estadosConversacion[chatId].estado;

    if (estado === 'esperando_valor_total') {
        if (!isNaN(parseFloat(respuesta))) {
            const valorTotal = parseFloat(respuesta);
            estadosConversacion[chatId].valorTotal = valorTotal;
            estadosConversacion[chatId].estado = 'esperando_dinero_recibido';
            await enviarMensaje(client, chatId, '¿Cuánta plata te dio?');
        } else {
            await iniciarConversacion(client, chatId);
        }
    } else if (estado === 'esperando_dinero_recibido') {
        if (!isNaN(parseFloat(respuesta))) {
            const dineroRecibido = parseFloat(respuesta);

            try {
                const valorTotal = estadosConversacion[chatId].valorTotal;
                const response = await axios.post(`${apiUrl}/sumar`, {
                    numero1: valorTotal,
                    numero2: -dineroRecibido // Calculamos el vuelto como una resta
                });

                const vuelto = response.data.resultado;
                let respuestaBot = `El vuelto es: ${vuelto}\n`;

                if (vuelto > 0) {
                    // Calcula la cantidad de cada billete
                    const billetes = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
                    let vueltoRestante = vuelto;

                    respuestaBot += 'Cantidad de billetes a entregar:\n';
                    for (const billete of billetes) {
                        const cantidad = Math.floor(vueltoRestante / billete);
                        vueltoRestante %= billete;

                        if (cantidad > 0) {
                            respuestaBot += `$${billete}: ${cantidad}\n`;
                        }
                    }
                }

                // Enviar la respuesta al chat
                await enviarMensaje(client, chatId, respuestaBot);

                // Reiniciar la conversación
                delete estadosConversacion[chatId];
                await iniciarConversacion(client, chatId);
            } catch (error) {
                console.error('Error al calcular el vuelto:', error);
                // Enviar un mensaje de error al chat
                await enviarMensaje(client, chatId, 'Ocurrió un error al calcular el vuelto.');

                // Reiniciar la conversación
                delete estadosConversacion[chatId];
                await iniciarConversacion(client, chatId);
            }
        } else {
            await enviarMensaje(client, chatId, 'Por favor, ingresa un valor válido.');
        }
    }
}

// Función para iniciar el chatbot
const iniciarChatbot = async () => {
    const client = await createClient();

    client.onMessage(async message => {
        const chatId = message.from;
        const contenidoMensaje = message.body;

        if (!estadosConversacion[chatId]) {
            // Si el chat no está en una conversación, iniciarla
            await iniciarConversacion(client, chatId);
        } else {
            await procesarRespuesta(client, chatId, contenidoMensaje);
        }
    });
};

// Iniciar el chatbot npm start
iniciarChatbot();