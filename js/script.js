const CONTRACT = "0xbad983a992914870e50Ef61fc8e645F5857DDd6d";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
const RPC_URL = "https://optimism.llamarpc.com";
// const RPC_URL = "https://mainnet.optimism.io";
const HARBINGERS = 12;
const NETWORK = { name: "optimism", chainId: 10 };

const ABI = [
  "function acquire(uint256 tokenId, uint256 valuation) external payable",
  "function acquisitionPrice(uint256 tokenId) external view returns (uint256)",
  "function valuations(uint256 tokenId) external view returns (uint256)",
];

const MC_ABI = [
  `function aggregate3((address target, bool allowFailure, bytes callData)[] calldata calls) external view returns ((bool success, bytes returnData)[] memory returnData)`,
];

let provider = null;
let contract = null;
let multicall = null;
let address = null;

function init() {
  fetchPrices();
}

async function fetchPrices() {
  const rpc = new ethers.providers.JsonRpcProvider(RPC_URL);
  const interface = new ethers.utils.Interface(ABI);
  const multicall = new ethers.Contract(MULTICALL, MC_ABI, rpc);

  const calls = [];
  for (let i = 1; i <= HARBINGERS; i++) {
    calls.push({
      target: CONTRACT,
      allowFailure: true,
      callData: interface.encodeFunctionData("acquisitionPrice", [i]),
    });
  }

  const results = await multicall.aggregate3(calls);

  for (let i = 0; i < results.length; i++) {
    // ignore failed fetches
    if (!results[i].success) {
      console.error("failed", i);
      continue;
    }

    let price = ethers.utils.formatEther(results[i].returnData);

    const precision = Math.floor(Math.log10(price));
    if (precision < -1) {
      price = Number(
        Math.round(price * Math.pow(10, -precision)) * Math.pow(10, precision)
      ).toFixed(-precision);
    } else {
      price = Number(price).toFixed(2);
    }

    updatePrice(i + 1, price);
  }
}

function updatePrice(tokenId, price) {
  const el = document.getElementById(`price-${tokenId}`);
  el.innerText = `Current market price: ${price} ETH`;
}

async function connect() {
  if (window.ethereum == null) {
    alert("‧˚₊•┈┈┈୨ Please use an injected web3 wallet ୧┈┈┈•‧₊˚⊹");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum, NETWORK);
  contract = new ethers.Contract(CONTRACT, ABI, provider);

  provider.provider.on("accountsChanged", function (accounts) {
    address = accounts[0];
    onConnect(true, address);
  });

  provider.on("network", (newNetwork, oldNetwork) => {
    if (oldNetwork) {
      window.location.reload();
    }
  });

  const accounts = await provider.send("eth_requestAccounts", []);
  if (accounts.length > 0) {
    address = accounts[0];
    onConnect(true, address);
  } else {
    address = null;
    onConnect(false, null);
  }
}

async function onConnect(status, address) {
  if (status) {
    const shortAddress = address.substr(0, 6) + "..." + address.substr(-4);
    btnConnect.innerText = shortAddress;
  } else {
    btnConnect.innerText = "Connect";
  }
}

async function acquire(tokenId) {
  if (address == null) {
    alert("‧˚₊•┈┈┈┈୨ Please connect your wallet ୧┈┈┈┈•‧₊˚⊹");
    return;
  }

  let n = Number(tokenId);
  if (isNaN(n) || n < 1 || n > 12) {
    return console.error("invalid id:", tokenId);
  }

  try {
    let price = await contract.acquisitionPrice(tokenId);
    let valuation = await contract.valuations(tokenId);

    price = price.mul(100).div(90);
    valuation = valuation.mul(100).div(95);

    const contractWithSigner = contract.connect(provider.getSigner(address));
    const tx = await contractWithSigner.acquire(tokenId, valuation, {
      value: price,
    });
    await tx.wait();
  } catch (err) {
    alert(err.message);
  }

  await fetchPrices();
}
