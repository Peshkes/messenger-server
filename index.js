const express = require('express');
const WebSocket = require('ws');
const https = require('https'); // Заменяем http на https
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Модуль для работы с файловой системой

const app = express();

// Создаем HTTPS сервер
const server = https.createServer({}, app);

// Настраиваем WebSocket сервер поверх HTTPS
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 443; // Порт 443 по умолчанию для HTTPS

const users = new Map();

app.use(cors());
app.use(express.json());

// Статические файлы для фронтенда
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/register', (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ message: 'Username is required.' });
    }

    if (users.has(username)) {
        return res.status(400).json({ message: 'Username already taken.' });
    }
    console.log(users);
    res.status(200).json({ message: 'User registered successfully.' });
});

// Обработка подключений WebSocket
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const username = url.searchParams.get('username');

    if (!username) {
        ws.close(4000, 'Username not provided.');
        return;
    }

    if (users.has(username)) {
        ws.close(4001, 'Username already connected.');
        return;
    }

    users.set(username, ws);
    broadcastUserList();

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'MESSAGE') {
                const { from, to, text, date } = data.message;

                const recipientWs = users.get(to);
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify({
                        type: 'MESSAGE',
                        message: { from, text, date }
                    }));
                }
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        users.delete(username);
        broadcastUserList();
    });
});

// Функция для отправки списка пользователей
const broadcastUserList = () => {
    const userList = Array.from(users.keys());
    const message = JSON.stringify({ type: 'USER_LIST', users: userList });

    users.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
};

// Запуск сервера
server.listen(port, () => {
    console.log(`Server is running on https://localhost:${port}`);
});
