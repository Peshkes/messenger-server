const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 443;

// Создаем HTTP-сервер
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});

// Настраиваем WebSocket сервер поверх HTTP
const wss = new WebSocket.Server({ server });

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

    users.set(username, null);
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

    if (users.has(username) && users.get(username)) {
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
