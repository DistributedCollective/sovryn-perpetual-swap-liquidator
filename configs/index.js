let config = require('./testnet');

if (process.argv.indexOf('--local') >= 0) {
    config = require('./local');
    console.log('Using local config');
} else if (process.argv.indexOf('--mainnet') >= 0) {
    config = require('./main');
    console.log('Using mainnet config');
} else {
    console.log('Using testnet config');
}

module.exports = config;