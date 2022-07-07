const configFileName = process.argv?.[2] || ".env";
const path = require("path");
let configPath = path.join(__dirname, "/", configFileName);
require("dotenv").config({ path: configPath });

const { SERVER_PORT } = process.env;

const express= require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const main = require("./src/main.ts");

app.use("/", express.static("public/dist"));

http.listen(SERVER_PORT, () => {
    console.log("listening on *:" + SERVER_PORT);
});

main.start(io)
    .then((r) => {
        console.log("main.start() returned: done??", r);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
