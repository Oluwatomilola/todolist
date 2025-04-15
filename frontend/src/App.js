import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Box, Button, Input, VStack, Text, Heading } from '@chakra-ui/react';
import { useToast } from '@chakra-ui/react';

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const toast = useToast();

  // Contract address - replace with your deployed contract address
  const contractAddress = '0x445744147560636C895A1B522cc7c50E8e583031';
  
  // Contract ABI - moved inside useMemo to prevent recreation on every render
  const contractABI = useMemo(() => [
    "function addTask(string memory _description) public",
    "function completeTask(uint256 _index) public",
    "function getTask(uint256 _index) public view returns (string memory, bool)",
    "function getTaskCount() public view returns (uint256)"
  ], []);

  // Filecoin Calibration testnet configuration
  const calibrationConfig = {
    chainId: '0x4cb2f', // 314159 in hex
    chainName: 'Filecoin Calibration',
    nativeCurrency: {
      name: 'Test FIL',
      symbol: 'tFIL',
      decimals: 18
    },
    rpcUrls: ['https://api.calibration.node.glif.io/rpc/v1'],
    blockExplorerUrls: ['https://calibration.filscan.io']
  };

  // Check for MetaMask availability
  useEffect(() => {
    const checkMetaMask = () => {
      try {
        if (window.ethereum && window.ethereum.isMetaMask) {
          setHasMetaMask(true);
          // Set MetaMask as the provider
          window.ethereum = window.ethereum.providers?.find(p => p.isMetaMask) || window.ethereum;
        } else {
          setHasMetaMask(false);
        }
      } catch (error) {
        console.error('Error checking MetaMask:', error);
        setHasMetaMask(false);
      }
    };

    // Initial check
    checkMetaMask();

    // Set up an interval to check for MetaMask
    const interval = setInterval(checkMetaMask, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadTasks = useCallback(async (contract) => {
    try {
      const taskCount = await contract.getTaskCount();
      const tasksArray = [];
      
      for (let i = 0; i < taskCount; i++) {
        const task = await contract.getTask(i);
        tasksArray.push({
          id: i,
          description: task[0],
          completed: task[1]
        });
      }
      
      setTasks(tasksArray);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        status: 'error',
        duration: 3000,
      });
    }
  }, [toast]);

  const switchToCalibration = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      // First try to switch the network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: calibrationConfig.chainId }]
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [calibrationConfig]
          });
        } else {
          throw switchError;
        }
      }

      // Wait a moment for the network to switch
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the network switch
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      if (network.chainId.toString() !== '314159') {
        throw new Error('Network switch failed');
      }
      
      setIsCorrectNetwork(true);
      toast({
        title: 'Success',
        description: 'Successfully switched to Filecoin Calibration',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error switching network:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch to Filecoin Calibration network. Please try again.',
        status: 'error',
        duration: 3000,
      });
      setIsCorrectNetwork(false);
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const checkNetwork = useCallback(async () => {
    try {
      if (!window.ethereum) {
        return false;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      const isCorrect = network.chainId.toString() === '314159';
      setIsCorrectNetwork(isCorrect);
      
      if (!isCorrect) {
        toast({
          title: 'Wrong Network',
          description: 'Please switch to Filecoin Calibration testnet',
          status: 'warning',
          duration: 5000,
        });
      }
      return isCorrect;
    } catch (error) {
      console.error('Error checking network:', error);
      setIsCorrectNetwork(false);
      return false;
    }
  }, [toast]);

  const connectWallet = useCallback(async () => {
    if (!hasMetaMask) {
      toast({
        title: 'Error',
        description: 'Please install MetaMask to use this application',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsConnecting(true);
    try {
      // Check if we're on the correct network
      const isCorrectNetwork = await checkNetwork();
      if (!isCorrectNetwork) {
        setIsConnecting(false);
        return;
      }

      // Request account access specifically from MetaMask
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts',
        params: [{ eth_accounts: {} }]
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      setAccount(accounts[0]);

      // Create provider and contract instance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const todoContract = new ethers.Contract(contractAddress, contractABI, signer);
      setContract(todoContract);

      // Load initial tasks
      await loadTasks(todoContract);
    } catch (error) {
      console.error('Error connecting to MetaMask:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to MetaMask. Please try again.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [contractABI, loadTasks, toast, checkNetwork, hasMetaMask]);

  useEffect(() => {
    // Add event listeners for account and chain changes
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount('');
        setContract(null);
        setTasks([]);
      } else {
        setAccount(accounts[0]);
        connectWallet();
      }
    };

    const handleChainChanged = () => {
      checkNetwork();
    };

    if (window.ethereum) {
      try {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
      } catch (error) {
        console.error('Error setting up event listeners:', error);
      }
    }

    return () => {
      if (window.ethereum) {
        try {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        } catch (error) {
          console.error('Error removing event listeners:', error);
        }
      }
    };
  }, [connectWallet, checkNetwork]);

  const addTask = async () => {
    if (!newTask.trim()) return;

    try {
      const tx = await contract.addTask(newTask);
      await tx.wait();
      setNewTask('');
      loadTasks(contract);
      toast({
        title: 'Success',
        description: 'Task added successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: 'Error',
        description: 'Failed to add task',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const completeTask = async (index) => {
    try {
      const tx = await contract.completeTask(index);
      await tx.wait();
      loadTasks(contract);
      toast({
        title: 'Success',
        description: 'Task marked as completed',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete task',
        status: 'error',
        duration: 3000,
      });
    }
  };

  return (
    <Box p={8} maxW="600px" mx="auto">
      <Heading mb={6} style={{color: 'yellowgreen'}}>Todo List dApp</Heading>
      
      {!hasMetaMask ? (
        <Text color="red.500">
          Please install MetaMask to use this application
        </Text>
      ) : (
        <>
          {!isCorrectNetwork ? (
            <Button 
              colorScheme="blue" 
              onClick={switchToCalibration}
              isLoading={isConnecting}
              loadingText="Switching Network..."
            >
              Switch to Filecoin Calibration
            </Button>
          ) : !account ? (
            <Button 
              colorScheme="blue" 
              onClick={connectWallet}
              isLoading={isConnecting}
              loadingText="Connecting..."
            >
              Connect Wallet
            </Button>
          ) : (
            <>
              <Text mb={4}>Connected Account: {account}</Text>
              <VStack spacing={4} align="stretch">
                <Input
                  placeholder="Add a new task"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                />
                <Button colorScheme="blue" onClick={addTask}>
                  Add Task
                </Button>

                <VStack spacing={2} align="stretch" mt={4}>
                  {tasks.map((task) => (
                    <Box
                      key={task.id}
                      p={4}
                      borderWidth="1px"
                      borderRadius="md"
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Text textDecoration={task.completed ? 'line-through' : 'none'}>
                        {task.description}
                      </Text>
                      {!task.completed && (
                        <Button
                          colorScheme="green"
                          size="sm"
                          onClick={() => completeTask(task.id)}
                        >
                          Complete
                        </Button>
                      )}
                    </Box>
                  ))}
                </VStack>
              </VStack>
            </>
          )}
        </>
      )}
    </Box>
  );
}

export default App; 