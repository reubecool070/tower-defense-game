import {
  DEFAULT_ROWS,
  DEFAULT_COLS,
  START_NODE_ROW,
  START_NODE_COLUMN,
  FINISH_NODE_ROW,
  FINISH_NODE_COLUMN,
} from "../../utils/constant";
import { TileNode } from "../../types";
import { astar, getShortestPathInOrder } from "../../algorithms/astar";

export class PathManager {
  private tilesGrid: TileNode[][] = [];
  private path: TileNode[] = [];

  constructor() {
    this.tilesGrid = this.createTilesGrid();
    this.calculateInitialPath();
  }

  public getTilesGrid(): TileNode[][] {
    return this.tilesGrid;
  }

  public setTilesGrid(grid: TileNode[][]): void {
    this.tilesGrid = grid;
  }

  public getPath(): TileNode[] {
    return this.path;
  }

  public setPath(path: TileNode[]): void {
    this.path = path;
  }

  public createTilesGrid(): TileNode[][] {
    const tiles: TileNode[][] = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      const currentRow: TileNode[] = [];
      for (let y = 0; y < DEFAULT_COLS; y++) {
        currentRow.push(this.createInitialNode(x, y));
      }
      tiles.push(currentRow);
    }
    return tiles;
  }

  public resetTilesGrid(): TileNode[][] {
    const tiles: TileNode[][] = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      const currentRow: TileNode[] = [];
      for (let y = 0; y < DEFAULT_COLS; y++) {
        const node = this.tilesGrid[x][y];
        currentRow.push({
          ...node,
          distance: Infinity,
          totalDistance: Infinity,
          isVisited: false,
          previousNode: null,
        });
      }
      tiles.push(currentRow);
    }
    return tiles;
  }

  private createInitialNode(x: number, y: number): TileNode {
    return {
      startNode: x === START_NODE_ROW && y === START_NODE_COLUMN,
      finishNode: x === FINISH_NODE_ROW && y === FINISH_NODE_COLUMN,
      row: x,
      col: y,
      distance: Infinity,
      totalDistance: Infinity,
      isVisited: false,
      isTower: false,
      previousNode: null,
      name: `node`,
    };
  }

  public calculateInitialPath(): void {
    const startNode = this.tilesGrid[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = this.tilesGrid[FINISH_NODE_ROW][FINISH_NODE_COLUMN];
    astar(this.tilesGrid, startNode, finishNode);
    const shortestPathInOrder = getShortestPathInOrder(finishNode);
    this.path = shortestPathInOrder;
  }

  public calculatePath(grid: TileNode[][]): TileNode[] {
    const startNode = grid[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = grid[FINISH_NODE_ROW][FINISH_NODE_COLUMN];
    astar(grid, startNode, finishNode);
    return getShortestPathInOrder(finishNode);
  }

  public isPathValid(towerX: number, towerY: number): boolean {
    const _grids = this.resetTilesGrid();
    _grids[towerX][towerY].isTower = true;

    const startNode = _grids[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = _grids[FINISH_NODE_ROW][FINISH_NODE_COLUMN];

    astar(_grids, startNode, finishNode);
    const shortestPathInOrder = getShortestPathInOrder(finishNode);

    return shortestPathInOrder.length > 1;
  }

  public updateGridWithTower(x: number, y: number): TileNode[][] {
    const newGrid = this.resetTilesGrid();
    newGrid[x][y].isTower = true;
    return newGrid;
  }
}
