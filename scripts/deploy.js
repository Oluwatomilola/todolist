const hre = require("hardhat");

async function main() {
  // Get the contract factory
  const TodoListFactory = await hre.ethers.getContractFactory("TodoList");

  // Deploy the contract
  const todoList = await TodoListFactory.deploy();

  // Wait for deployment to complete
  await todoList.waitForDeployment(); //his replaces .deployed() in newer Hardhat versions

  console.log("TodoList deployed to:", await todoList.getAddress());
}

main().catch((error) => {
  console.error("❌ Error deploying contract:", error);
  process.exitCode = 1;
});
