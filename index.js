// librerias
const http    = require('http');
const express = require('express');
const app     = express();

app.get('/', (request, response, next) => {
    response.setHeader('Content-Type', 'text/plain');
    response.send("Hola Mundo");
    response.end(); 
});

/*
const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host:"127.0.0.1",
    user:"root",
    password:"1234",
    database:"appix",
    connectionLimit:5
});

app.get('/test_db', async(request, response, next) => {
    let conn;

    try{
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT * FROM proyecto")
        console.log(rows);
        const jsonS = JSON.stringify(rows);
        response.writeHead(200, {'Content-type':'text/html'});
        response.end(jsonS);
    }catch(e){
        console.log(e)
    }
});
*/

// apertura del servidor
const server = http.createServer( (request, response) => {    
    console.log(request.url);
});
app.listen(3000);