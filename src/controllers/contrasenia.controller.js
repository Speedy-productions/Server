const path = require("path");

const showForm = (req, res) => {
  res.sendFile(path.join(__dirname, "../views/contrasenia.view.html"));
};

module.exports = { showForm };
