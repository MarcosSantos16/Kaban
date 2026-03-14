require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const session      = require('express-session');
const path         = require('path');
const { conectar } = require('./db/database');

const authRoutes    = require('./routes/auth');
const tarefasRoutes = require('./routes/tarefas');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret:            process.env.SESSION_SECRET || 'kanban_secreto',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.redirect('/login.html'));
app.use('/api/auth',    authRoutes);
app.use('/api/tarefas', tarefasRoutes);

conectar()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Falha ao conectar no banco:', err.message);
    process.exit(1);
  });