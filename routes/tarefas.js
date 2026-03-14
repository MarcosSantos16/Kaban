const express      = require('express');
const { conectar } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const conn = await conectar();
    const [rows] = await conn.execute(
      'SELECT * FROM tarefas WHERE user_id = ? ORDER BY criado_em DESC',
      [req.session.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar tarefas.' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const { titulo, descricao, prioridade, status, prazo } = req.body;
  if (!titulo) return res.status(400).json({ error: 'Título é obrigatório.' });

  const statusValido = ['todo','doing','done'].includes(status) ? status : 'todo';

  try {
    const conn = await conectar();
    const [result] = await conn.execute(
      'INSERT INTO tarefas (user_id, titulo, descricao, prioridade, status, prazo) VALUES (?, ?, ?, ?, ?, ?)',
      [req.session.user.id, titulo, descricao || null, prioridade || 'media', statusValido, prazo || null]
    );
    const [rows] = await conn.execute('SELECT * FROM tarefas WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar tarefa.' });
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['todo','doing','done'].includes(status))
    return res.status(400).json({ error: 'Status inválido.' });

  try {
    const conn = await conectar();
    const [rows] = await conn.execute(
      'SELECT id FROM tarefas WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });

    await conn.execute('UPDATE tarefas SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status atualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { titulo, descricao, prioridade, prazo } = req.body;
  if (!titulo) return res.status(400).json({ error: 'Título é obrigatório.' });

  try {
    const conn = await conectar();
    const [rows] = await conn.execute(
      'SELECT id FROM tarefas WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });

    await conn.execute(
      'UPDATE tarefas SET titulo = ?, descricao = ?, prioridade = ?, prazo = ? WHERE id = ?',
      [titulo, descricao || null, prioridade || 'media', prazo || null, req.params.id]
    );
    res.json({ message: 'Tarefa atualizada.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const conn = await conectar();
    const [rows] = await conn.execute(
      'SELECT id FROM tarefas WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });

    await conn.execute('DELETE FROM tarefas WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tarefa excluída.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir tarefa.' });
  }
});

module.exports = router;