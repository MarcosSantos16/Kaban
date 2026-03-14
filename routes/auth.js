const express      = require('express');
const bcrypt       = require('bcryptjs');
const { conectar } = require('../db/database');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ error: 'Preencha todos os campos.' });
  if (senha.length < 6)         return res.status(400).json({ error: 'Senha mínima de 6 caracteres.' });

  try {
    const conn = await conectar();
    const [existe] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existe.length > 0) return res.status(409).json({ error: 'Email já cadastrado.' });

    const hash = await bcrypt.hash(senha, 10);
    const [result] = await conn.execute(
      'INSERT INTO users (nome, email, senha) VALUES (?, ?, ?)',
      [nome, email, hash]
    );

    req.session.user = { id: result.insertId, nome, email };
    res.status(201).json({ message: 'Cadastro realizado!', user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'Preencha todos os campos.' });

  try {
    const conn = await conectar();
    const [rows] = await conn.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Email ou senha incorretos.' });

    const user = rows[0];
    const ok   = await bcrypt.compare(senha, user.senha);
    if (!ok) return res.status(401).json({ error: 'Email ou senha incorretos.' });

    req.session.user = { id: user.id, nome: user.nome, email: user.email };
    res.json({ message: 'Login realizado!', user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout realizado.' });
});

router.get('/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ user: req.session.user });
});

module.exports = router;