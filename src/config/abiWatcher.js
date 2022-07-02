export default [
    {
        "inputs": [
            {
                "internalType": "contract ISovrynProtocol",
                "name": "_sovrynProtocol",
                "type": "address"
            },
            {
                "internalType": "contract ISovrynSwapNetwork",
                "name": "_sovrynSwapNetwork",
                "type": "address"
            },
            {
                "internalType": "contract IPriceFeeds",
                "name": "_priceFeeds",
                "type": "address"
            },
            {
                "internalType": "contract IWRBTCToken",
                "name": "_wrbtcToken",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "_sourceToken",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "_targetToken",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_sourceTokenAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_targetTokenAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_priceFeedAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_profit",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "address",
                "name": "_sender",
                "type": "address"
            }
        ],
        "name": "Arbitrage",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "_loanId",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "_loanToken",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "_seizedToken",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_closeAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_seizedAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "address",
                "name": "_sender",
                "type": "address"
            }
        ],
        "name": "Liquidation",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "previousAdminRole",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "newAdminRole",
                "type": "bytes32"
            }
        ],
        "name": "RoleAdminChanged",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "sender",
                "type": "address"
            }
        ],
        "name": "RoleGranted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "sender",
                "type": "address"
            }
        ],
        "name": "RoleRevoked",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "_loanId",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "_sourceToken",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "_targetToken",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_sourceTokenAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "_targetTokenAmount",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "address",
                "name": "_sender",
                "type": "address"
            }
        ],
        "name": "Swapback",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "DEFAULT_ADMIN_ROLE",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "RBTC_ADDRESS",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "ROLE_EXECUTOR",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "ROLE_OWNER",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IERC20[]",
                "name": "_conversionPath",
                "type": "address[]"
            },
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_minProfit",
                "type": "uint256"
            }
        ],
        "name": "arbitrage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IERC20",
                "name": "_token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            }
        ],
        "name": "depositTokens",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            }
        ],
        "name": "getRoleAdmin",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            },
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "grantRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            },
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "hasRole",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "_loanId",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "_closeAmount",
                "type": "uint256"
            }
        ],
        "name": "liquidate",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "loanCloseAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "seizedAmount",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "seizedToken",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "_loanId",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "_closeAmount",
                "type": "uint256"
            },
            {
                "internalType": "contract IERC20[]",
                "name": "_swapbackConversionPath",
                "type": "address[]"
            },
            {
                "internalType": "uint256",
                "name": "_swapbackMinProfit",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "_requireSwapback",
                "type": "bool"
            }
        ],
        "name": "liquidateWithSwapback",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "loanCloseAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "seizedAmount",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "seizedToken",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "priceFeeds",
        "outputs": [
            {
                "internalType": "contract IPriceFeeds",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            },
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "renounceRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "role",
                "type": "bytes32"
            },
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "revokeRole",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IPriceFeeds",
                "name": "_priceFeeds",
                "type": "address"
            }
        ],
        "name": "setPriceFeeds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract ISovrynProtocol",
                "name": "_sovrynProtocol",
                "type": "address"
            }
        ],
        "name": "setSovrynProtocol",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract ISovrynSwapNetwork",
                "name": "_sovrynSwapNetwork",
                "type": "address"
            }
        ],
        "name": "setSovrynSwapNetwork",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IWRBTCToken",
                "name": "_wrbtcToken",
                "type": "address"
            }
        ],
        "name": "setWRBTCToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "sovrynProtocol",
        "outputs": [
            {
                "internalType": "contract ISovrynProtocol",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "sovrynSwapNetwork",
        "outputs": [
            {
                "internalType": "contract ISovrynSwapNetwork",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes4",
                "name": "interfaceId",
                "type": "bytes4"
            }
        ],
        "name": "supportsInterface",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            },
            {
                "internalType": "address payable",
                "name": "_receiver",
                "type": "address"
            }
        ],
        "name": "withdrawRbtc",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "contract IERC20",
                "name": "_token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            },
            {
                "internalType": "address payable",
                "name": "_receiver",
                "type": "address"
            }
        ],
        "name": "withdrawTokens",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "wrbtcToken",
        "outputs": [
            {
                "internalType": "contract IWRBTCToken",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    }
];
