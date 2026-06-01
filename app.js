const app = require('./server');
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n✅  Serveur démarré sur http://localhost:${PORT}\n`);
  });
}

module.exports = app;
