// Import sqlite3 and enable verbose mode (shows detailed errors)
const sqlite3 = require('sqlite3').verbose();

// Connect (or create) a local database file
const db = new sqlite3.Database('test.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Create a table if it doesn’t exist
db.run(
  `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
  )`,
  (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Table ready.');
      
      // Insert a user
      db.run(`INSERT INTO users (name) VALUES (?)`, ['Lalo'], function (err) {
        if (err) {
          console.error('Error inserting:', err.message);
        } else {
          console.log(`Inserted user with ID ${this.lastID}`);
        }

        // Query all users
        db.all(`SELECT * FROM users`, (err, rows) => {
          if (err) {
            console.error('Error selecting:', err.message);
          } else {
            console.log('Users:');
            rows.forEach(row => console.log(row));
          }

          // Always close the database when done
          db.close((err) => {
            if (err) console.error('Error closing database:', err.message);
            else console.log('Database closed.');
          });
        });
      });
    }
  }
);