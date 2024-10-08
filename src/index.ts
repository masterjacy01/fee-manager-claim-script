import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { feeManagerAbi } from "./abis/FeeManagerAbi";
import { vaultAbi } from "./abis/VaultAbi";
dotenv.config();

// Load environment variables
const providerUrl = process.env.PROVIDER_URL || "";
const privateKey = process.env.PRIVATE_KEY || "";
const feeManagerAddress = process.env.FEE_MANAGER_ADDRESS || "";
const vaultAddress = process.env.VAULT_ADDRESS || "";
const deploymentBlock = Number(process.env.VAULT_DEPLOYMENT_BLOCK) || 20290768;

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(providerUrl);
const wallet = new ethers.Wallet(privateKey, provider);
const feeManagerContract = new ethers.Contract(
  feeManagerAddress,
  feeManagerAbi,
  wallet
);
const vaultContract = new ethers.Contract(vaultAddress, vaultAbi, wallet);

// Example function to fetch token holders from Transfer events
async function getTokenHolders() {
  const tokenHolders: Set<string> = new Set();
  const latestBlock = await provider.getBlockNumber();
  const blockRangeLimit = 10000;

  for (
    let startBlock = deploymentBlock;
    startBlock <= latestBlock;
    startBlock += blockRangeLimit
  ) {
    const endBlock = Math.min(startBlock + blockRangeLimit - 1, latestBlock);

    // Fetch past transfer events from the vault contract
    const filter = vaultContract.filters.Transfer(null, null);
    const events = await vaultContract.queryFilter(
      filter,
      startBlock,
      endBlock
    ); // Fetch events within the block range

    events.forEach((event: any) => {
      const { from, to } = event.args!;
      if (from !== ethers.ZeroAddress) {
        tokenHolders.add(from);
      }
      if (to !== ethers.ZeroAddress) {
        tokenHolders.add(to);
      }
    });
  }

  console.log("Token Holders:");
  Array.from(tokenHolders).forEach((tokenHolder) => console.log(tokenHolder));

  return Array.from(tokenHolders);
}

// Claim fees for users
async function claimFeesForUsers() {
  const users = await getTokenHolders(); // Fetch all users (token holders)

  console.log("Starting to claim fees...");
  for (const user of users) {
    console.log(`Claiming fees for user: ${user}`);
    try {
      const tx = await feeManagerContract.claimFees(user);
      console.log(`Transaction Hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    } catch (error) {
      console.error(`Error claiming fees for ${user}:`, error);
    }
  }
}

async function main() {
  await claimFeesForUsers();
}

main().catch((error) => {
  console.error("Error in main execution:", error);
});
