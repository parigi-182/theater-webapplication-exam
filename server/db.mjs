/** DB access module **/

import sqlite from 'sqlite3';

// open the database
const db = new sqlite.Database('theatre.db', (err) => {
  if (err) throw err;
});

//export default db;

/*
    sqlite3 needs a callback, there are Promise wrapper for the db queries
*/

const dbGet = (sql, params) => new Promise((resolve, reject) =>{
    db.get(sql, params, (err, row) =>{
        if(err) return reject(err);
        resolve (row);
    });
});

const dbAll = (sql, params) => new Promise((resolve, reject) =>{
    db.all(sql, params, (err, rows) =>{
        if(err) return reject(err);
        resolve(rows);
    });
});

const dbRun = (sql, params) => new Promise((resolve, reject) =>{
    db.run(sql, params, function(err){ /* need to returns db.run.elements */
        if(err) return reject(err);
        resolve(this); 
    });
});

const queryDB = {
    dbGet, dbAll, dbRun
};

export {queryDB};