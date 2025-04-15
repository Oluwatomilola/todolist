// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TodoList {
    
    // Define a task structure
    struct Task {
        string description;
        bool completed;
    }

    // Mapping from user address to their list of tasks
    mapping(address => Task[]) private userTasks;

    // Event emitted when a new task is added
    event TaskAdded(address indexed user, uint taskIndex, string description);

    // Event emitted when a task is marked as completed
    event TaskCompleted(address indexed user, uint taskIndex);

    // Add a new task
    function addTask(string calldata _description) external {
        userTasks[msg.sender].push(Task({
            description: _description,
            completed: false
        }));

        emit TaskAdded(msg.sender, userTasks[msg.sender].length - 1, _description);
    }

    // Mark an existing task as completed
    function completeTask(uint _index) external {
        require(_index < userTasks[msg.sender].length, "Invalid task index");
        Task storage task = userTasks[msg.sender][_index];
        require(!task.completed, "Task already completed");

        task.completed = true;

        emit TaskCompleted(msg.sender, _index);
    }

    // View all tasks of the sender
    function getMyTasks() external view returns (Task[] memory) {
        return userTasks[msg.sender];
    }

    // Get a specific task by index
    function getTask(uint _index) external view returns (string memory description, bool completed) {
        require(_index < userTasks[msg.sender].length, "Invalid task index");
        Task storage task = userTasks[msg.sender][_index];
        return (task.description, task.completed);
    }

    // Get the total number of tasks for the sender
    function getTaskCount() external view returns (uint) {
        return userTasks[msg.sender].length;
    }
}
