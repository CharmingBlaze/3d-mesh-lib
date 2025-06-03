/**
 * Manages the selection of mesh components (vertices, edges, faces).
 */
export class SelectionManager {
  private selectedVertexIds: Set<number> = new Set();
  private selectedEdgeIds: Set<number> = new Set();
  private selectedFaceIds: Set<number> = new Set();

  constructor() {}

  // --- Vertex Selection --- 
  public selectVertex(id: number, additive: boolean = false): void {
    if (!additive) {
      this.clearVertexSelection();
    }
    this.selectedVertexIds.add(id);
  }

  public deselectVertex(id: number): void {
    this.selectedVertexIds.delete(id);
  }

  public toggleVertexSelection(id: number): void {
    if (this.selectedVertexIds.has(id)) {
      this.deselectVertex(id);
    } else {
      this.selectVertex(id, true); // Additive selection when toggling to select
    }
  }

  public getSelectedVertexIds(): ReadonlySet<number> {
    return this.selectedVertexIds;
  }

  public clearVertexSelection(): void {
    this.selectedVertexIds.clear();
  }

  // --- Edge Selection --- 
  public selectEdge(id: number, additive: boolean = false): void {
    if (!additive) {
      this.clearEdgeSelection();
    }
    this.selectedEdgeIds.add(id);
  }

  public deselectEdge(id: number): void {
    this.selectedEdgeIds.delete(id);
  }

  public toggleEdgeSelection(id: number): void {
    if (this.selectedEdgeIds.has(id)) {
      this.deselectEdge(id);
    } else {
      this.selectEdge(id, true); // Additive selection
    }
  }

  public getSelectedEdgeIds(): ReadonlySet<number> {
    return this.selectedEdgeIds;
  }

  public clearEdgeSelection(): void {
    this.selectedEdgeIds.clear();
  }

  // --- Face Selection --- 
  public selectFace(id: number, additive: boolean = false): void {
    if (!additive) {
      this.clearFaceSelection();
    }
    this.selectedFaceIds.add(id);
  }

  public deselectFace(id: number): void {
    this.selectedFaceIds.delete(id);
  }

  public toggleFaceSelection(id: number): void {
    if (this.selectedFaceIds.has(id)) {
      this.deselectFace(id);
    } else {
      this.selectFace(id, true); // Additive selection
    }
  }

  public getSelectedFaceIds(): ReadonlySet<number> {
    return this.selectedFaceIds;
  }

  public clearFaceSelection(): void {
    this.selectedFaceIds.clear();
  }

  // --- General Selection Management --- 
  public clearSelection(): void {
    this.clearVertexSelection();
    this.clearEdgeSelection();
    this.clearFaceSelection();
  }

  public isEmpty(): boolean {
    return (
      this.selectedVertexIds.size === 0 &&
      this.selectedEdgeIds.size === 0 &&
      this.selectedFaceIds.size === 0
    );
  }
}
