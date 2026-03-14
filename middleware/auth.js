function authMiddleware(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Não autenticado. Faça login.' });
  }
  next();
}

module.exports = { authMiddleware };
