import { TileNode } from "../types";

// Performs A* algorithm; returns *all* nodes in the order
// in which they were visited. Also makes nodes point back to their
// previous node, effectively allowing us to compute the shortest path
// by backtracking from the finish node.
export const astar = (
  grid: TileNode[][],
  startNode: TileNode,
  finishNode: TileNode
): TileNode[] | undefined => {
  if (!grid.length || !startNode || !finishNode || startNode === finishNode) return undefined;

  const visitedNodesInOrder: TileNode[] = [];
  startNode.distance = 0;
  startNode.totalDistance = heuristic(startNode, finishNode);
  const unvisitedNodes = getAllNodes(grid);

  while (unvisitedNodes.length) {
    // Sort nodes by total distance (distance + heuristic)
    sortNodesByTotalDistance(unvisitedNodes);
    // Extract the first node
    const closestNode = unvisitedNodes.shift()!;
    // If we encounter a wall, we skip it.
    if (closestNode.isTower) continue;
    // Stops if the closest node's distance is infinity.
    if (closestNode.distance === Infinity) return visitedNodesInOrder;
    closestNode.isVisited = true;
    visitedNodesInOrder.push(closestNode);

    if (closestNode === finishNode) return visitedNodesInOrder;
    updateUnvisitedNeighbors(closestNode, grid, finishNode);
  }

  return visitedNodesInOrder;
};

const getAllNodes = (grid: TileNode[][]): TileNode[] => {
  const nodes: TileNode[] = [];
  for (const row of grid) {
    for (const node of row) {
      nodes.push(node);
    }
  }
  return nodes;
};

const sortNodesByTotalDistance = (unvisitedNodes: TileNode[]): void => {
  unvisitedNodes.sort((a, b) => a.totalDistance - b.totalDistance);
};

const updateUnvisitedNeighbors = (
  closestNode: TileNode,
  grid: TileNode[][],
  finishNode: TileNode
): void => {
  const unvisitedNeighbors = getUnvisitedNeighbors(closestNode, grid);
  for (const neighbor of unvisitedNeighbors) {
    const distance = closestNode.distance + 1;
    if (distance < neighbor.distance) {
      neighbor.distance = distance;
      neighbor.totalDistance = distance + heuristic(neighbor, finishNode);
      neighbor.previousNode = closestNode;
    }
  }
};

const getUnvisitedNeighbors = (node: TileNode, grid: TileNode[][]): TileNode[] => {
  const neighbors: TileNode[] = [];
  const { col, row } = node;

  // Check if there's a node above the current node
  if (row > 0) neighbors.push(grid[row - 1][col]);

  // Check if there's a node below the current node
  if (row < grid.length - 1) neighbors.push(grid[row + 1][col]);

  // Check if there's a node to the left of the current node
  if (col > 0) neighbors.push(grid[row][col - 1]);

  // Check if there's a node to the right of the current node
  if (col < grid[0].length - 1) neighbors.push(grid[row][col + 1]);

  // Return only those neighbors that haven't been visited
  return neighbors.filter((neighbor) => !neighbor.isVisited);
};

// Manhattan distance heuristic
const heuristic = (node: TileNode, finishNode: TileNode): number => {
  const dx = Math.abs(node.col - finishNode.col);
  const dy = Math.abs(node.row - finishNode.row);
  return dx + dy;
};

export const getShortestPathInOrder = (finishNode: TileNode): TileNode[] => {
  let currentNode: TileNode | null = finishNode;
  const nodesInShortestPathOrder: TileNode[] = [];

  // Continue until there are no more previous nodes
  while (currentNode !== null) {
    // Add the current node to the beginning of the array
    nodesInShortestPathOrder.unshift(currentNode);
    // Move to the previous node
    currentNode = currentNode.previousNode;
  }

  // Return the nodes in the order of the shortest path
  return nodesInShortestPathOrder;
};
