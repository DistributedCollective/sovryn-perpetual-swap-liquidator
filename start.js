var _a;
var configFileName = ((_a = process.argv) === null || _a === void 0 ? void 0 : _a[2]) || ".env";
var path = require("path");
var configPath = path.join(__dirname, "/", configFileName);
require("dotenv").config({ path: configPath });
var SERVER_PORT = process.env.SERVER_PORT;
var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var main = require("./src/main.ts");
app.use("/", express.static("public/dist"));
http.listen(SERVER_PORT, function () {
    console.log("listening on *:" + SERVER_PORT);
});
console.log("Server started");
main.start(io)
    .then(function (r) {
    console.log("main.start() returned: done??", r);
})["catch"](function (err) {
    console.error(err);
    process.exit(1);
});
