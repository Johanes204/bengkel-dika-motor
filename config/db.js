const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',     
    database: 'dika_motor', 
});

db.connect((err) => {
    if (err) throw err;
    console.log('Database connected!');
});

module.exports = db;
