import { ICommand } from './ICommand';

/**
 * Manages a history of commands to support undo and redo functionality.
 */
export class HistoryManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private limit: number = 100; // Default maximum number of undo steps

  // Optional: For notifying UI about history changes. Could use a more robust event emitter.
  public onHistoryChange: (() => void) | null = null;

  /**
   * Creates an instance of HistoryManager.
   * @param limit - The maximum number of commands to keep in the undo history. Defaults to 100.
   */
  constructor(limit: number = 100) {
    this.limit = Math.max(1, limit); // Ensure limit is at least 1
  }

  /**
   * Executes a command, adds it to the undo stack, and clears the redo stack.
   * @param command - The command to execute.
   */
  executeCommand(command: ICommand): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Any new action clears the redo stack

    // Enforce the undo limit
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift(); // Remove the oldest command from the beginning of the array
    }
    this.triggerHistoryChange();
  }

  /**
   * Undoes the most recent command from the undo stack and moves it to the redo stack.
   */
  undo(): void {
    if (this.canUndo()) {
      const command = this.undoStack.pop()!;
      command.undo();
      this.redoStack.push(command);
      this.triggerHistoryChange();
    }
  }

  /**
   * Redoes the most recent command from the redo stack and moves it back to the undo stack.
   */
  redo(): void {
    if (this.canRedo()) {
      const command = this.redoStack.pop()!;
      command.execute(); // Or command.redo() if specific redo logic is needed
      this.undoStack.push(command);
      this.triggerHistoryChange();
    }
  }

  /**
   * Checks if there are any commands that can be undone.
   * @returns True if undo is possible, false otherwise.
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Checks if there are any commands that can be redone.
   * @returns True if redo is possible, false otherwise.
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clears both the undo and redo stacks.
   */
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.triggerHistoryChange();
  }

  /**
   * Gets the descriptions of commands in the undo stack (most recent first).
   * @returns An array of command descriptions.
   */
  getUndoStackDescriptions(): string[] {
    return this.undoStack.map(cmd => cmd.description || 'Unnamed Command').reverse();
  }

  /**
   * Gets the descriptions of commands in the redo stack (most recent undone first).
   * @returns An array of command descriptions.
   */
  getRedoStackDescriptions(): string[] {
    return this.redoStack.map(cmd => cmd.description || 'Unnamed Command').reverse();
  }

  private triggerHistoryChange(): void {
    if (this.onHistoryChange) {
      this.onHistoryChange();
    }
  }
}
